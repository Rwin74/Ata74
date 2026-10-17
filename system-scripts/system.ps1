param([Parameter(Mandatory=$true)][string]$Action,[string]$PayloadBase64='e30=')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try {
 $p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
 function Adapter([bool]$RequireUp=$false) {
  $a=@(Get-NetAdapter -IncludeHidden | Where-Object { $_.InterfaceGuid.ToString().Trim('{}') -eq $p.id })
  if($a.Count -ne 1){throw 'Ag karti bulunamadi; listeyi yenileyin.'}
  if($RequireUp -and ($a[0].Status -ne 'Up' -or -not $a[0].HardwareInterface)){throw 'Yalnizca bagli fiziksel ag karti secilebilir.'}
  return $a[0]
 }
 function DnsState($a) {
  $guid=$a.InterfaceGuid.ToString().Trim('{}')
  $key="HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\{$guid}"
  $raw=(Get-ItemProperty -LiteralPath $key).NameServer
  $addresses=@((Get-DnsClientServerAddress -InterfaceIndex $a.ifIndex -AddressFamily IPv4).ServerAddresses)
  return @{id=$guid;name=$a.Name;manual=(-not [string]::IsNullOrWhiteSpace($raw));servers=$addresses}
 }
 function ActivePower {
  $output=& powercfg.exe /getactivescheme
  if($LASTEXITCODE -ne 0){throw 'Guc plani okunamadi.'}
  $match=[regex]::Match(($output -join ' '),'[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}')
  if(-not $match.Success){throw 'Guc plani kimligi okunamadi.'}
  return $match.Value.ToLowerInvariant()
 }
 switch($Action) {
  'adapters' {
   $routes=@(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue)
   $data=@(Get-NetAdapter | ForEach-Object {
    $a=$_;$state=DnsState $a
    $iface=Get-NetIPInterface -InterfaceIndex $a.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
    $best=@($routes | Where-Object InterfaceIndex -eq $a.ifIndex | Sort-Object RouteMetric | Select-Object -First 1)
    @{id=$state.id;name=$a.Name;status=$a.Status.ToString();physical=[bool]$a.HardwareInterface;servers=$state.servers;manual=$state.manual;metric=if($best.Count){[int]$best[0].RouteMetric+[int]$iface.InterfaceMetric}else{999999}}
   })
   break
  }
  'dns-read' {$data=DnsState (Adapter);break}
  'dns-write' {
   $a=Adapter; $dns=Get-DnsClientServerAddress -InterfaceIndex $a.ifIndex -AddressFamily IPv4
   if($p.manual){
    $addresses=@($p.servers)
    if($addresses.Count -lt 1 -or $addresses.Count -gt 4){throw 'Gecersiz DNS listesi.'}
    foreach($ip in $addresses){$parsed=$null;if(-not [Net.IPAddress]::TryParse($ip,[ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Gecersiz IPv4 DNS.'}}
    $dns | Set-DnsClientServerAddress -ServerAddresses $addresses
   }else{$dns | Set-DnsClientServerAddress -ResetServerAddresses}
   $data=DnsState $a; break
  }
  'dns-validate-adapter' {$data=DnsState (Adapter $true);break}
  'flush' {Clear-DnsClientCache; $data=@{message='DNS onbellegi temizlendi. Ping dususu beklenmez.'};break}
  'ping' {
   $hostName=[string]$p.target
   if($hostName.Length -gt 253 -or $hostName -notmatch '^[a-zA-Z0-9.:-]+$'){throw 'Gecersiz hedef.'}
   $ping=New-Object Net.NetworkInformation.Ping;$items=@()
   try{for($i=0;$i -lt 12;$i++){
    try{$reply=$ping.Send($hostName,1000);if($reply.Status -eq 'Success'){$items+=@{ok=$true;ms=[double]$reply.RoundtripTime}}else{$items+=@{ok=$false;reason=$reply.Status.ToString()}}}
    catch{$items+=@{ok=$false;reason='DNS veya ICMP yaniti yok'}}
    if($i -lt 11){Start-Sleep -Milliseconds 200}
   }}finally{$ping.Dispose()}
   $data=@{target=$hostName;samples=$items};break
  }
  'power-read' {
   $active=ActivePower;$lines=& powercfg.exe /list;if($LASTEXITCODE -ne 0){throw 'Guc planlari listelenemedi.'}
   $plans=@();foreach($line in $lines){$m=[regex]::Match($line,'(?<id>[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})\s*\((?<name>.*)\)');if($m.Success){$plans+=@{id=$m.Groups['id'].Value.ToLowerInvariant();name=$m.Groups['name'].Value}}}
   $data=@{active=$active;plans=$plans};break
  }
  'power-write' {
   $guid=[guid]::Parse([string]$p.active).ToString(); & powercfg.exe /setactive $guid | Out-Null
   if($LASTEXITCODE -ne 0){throw 'Guc plani uygulanamadi veya desteklenmiyor.'}
   $data=@{active=(ActivePower)};break
  }
  'inspect' {
   $os=Get-CimInstance Win32_OperatingSystem
   $legacy=@();$base='HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'
   foreach($key in Get-ChildItem -LiteralPath $base){$v=Get-ItemProperty -LiteralPath $key.PSPath;foreach($n in @('TcpAckFrequency','TCPNoDelay')){if($null -ne $v.$n){$legacy+=@{location=$key.PSChildName;name=$n;value=$v.$n}}}}
   $sys=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'
   if($null -ne $sys.NetworkThrottlingIndex){$legacy+=@{location='SystemProfile';name='NetworkThrottlingIndex';value=$sys.NetworkThrottlingIndex}}
   $services=@(Get-Service -Name SysMain,DiagTrack,Spooler,DPS | ForEach-Object {@{name=$_.Name;status=$_.Status.ToString();startType=$_.StartType.ToString()}})
   $interrupt=@();foreach($a in Get-NetAdapter){try{$props=@(Get-NetAdapterAdvancedProperty -Name $a.Name -AllProperties -ErrorAction Stop | Where-Object RegistryKeyword -eq '*InterruptModeration');foreach($prop in $props){$interrupt+=@{adapter=$a.Name;value=$prop.DisplayValue}}}catch{$interrupt+=@{adapter=$a.Name;value='Desteklenmiyor / okunamadi'}}}
   $data=@{memoryTotalMB=[math]::Round($os.TotalVisibleMemorySize/1024);memoryFreeMB=[math]::Round($os.FreePhysicalMemory/1024);services=$services;legacy=$legacy;interrupt=$interrupt};break
  }
  default {throw 'Desteklenmeyen islem.'}
 }
 @{success=$true;data=$data} | ConvertTo-Json -Depth 12 -Compress
}catch{@{success=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress;exit 1}
