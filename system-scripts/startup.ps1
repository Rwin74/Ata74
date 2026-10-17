param([Parameter(Mandatory=$true)][string]$Action,[string]$PayloadBase64='e30=')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try{
 $p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64)) | ConvertFrom-Json
 $runPath='Software\Microsoft\Windows\CurrentVersion\Run'
 function Open-Run([string]$scope,[bool]$write=$false){
  if($write -and $scope -ne 'user'){throw 'Sistem genelindeki kayitlar salt okunur.'}
  $hive=[Microsoft.Win32.RegistryHive]::LocalMachine;$view=[Microsoft.Win32.RegistryView]::Registry64
  switch($scope){'user'{$hive=[Microsoft.Win32.RegistryHive]::CurrentUser} 'machine64'{} 'machine32'{$view=[Microsoft.Win32.RegistryView]::Registry32} default{throw 'Gecersiz kaynak.'}}
  $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
  try{return $base.OpenSubKey($runPath,$write)}finally{$base.Dispose()}
 }
 function Read-Entry($key,[string]$name){
  if($null -eq $key -or $key.GetValueNames() -notcontains $name){return @{exists=$false}}
  $kind=$key.GetValueKind($name).ToString();$value=$key.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  return @{exists=$true;kind=$kind;value=[string]$value}
 }
 switch($Action){
  'list'{
   $items=@();foreach($scope in @('user','machine64','machine32')){
    $key=Open-Run $scope;try{if($null -ne $key){foreach($name in $key.GetValueNames()){if($name.Length){$state=Read-Entry $key $name;$items+=@{source='run';scope=$scope;name=$name;kind=$state.kind;value=$state.value;writable=($scope -eq 'user' -and $state.kind -in @('String','ExpandString'))}}}}}finally{if($null -ne $key){$key.Dispose()}}
   }
   $data=@{entries=$items;startup=[Environment]::GetFolderPath('Startup');commonStartup=[Environment]::GetFolderPath('CommonStartup');account=([Environment]::UserDomainName+'\'+[Environment]::UserName)};break
  }
  'read'{$key=Open-Run $p.scope;try{$data=Read-Entry $key $p.name}finally{if($null -ne $key){$key.Dispose()}};break}
  'remove'{
   if($p.scope -ne 'user'){throw 'Salt okunur kaynak.'}
   $key=Open-Run 'user' $true;try{$current=Read-Entry $key $p.name;if(-not $current.exists -or $current.kind -ne $p.kind -or $current.value -cne $p.value){throw 'Kayit degismis; uzerine yazilmadi.'};$key.DeleteValue([string]$p.name,$true);$data=Read-Entry $key $p.name}finally{if($null -ne $key){$key.Dispose()}};break
  }
  'create'{
   if($p.scope -ne 'user' -or $p.kind -notin @('String','ExpandString')){throw 'Gecersiz geri yukleme kaydi.'}
   $key=Open-Run 'user' $true;if($null -eq $key){throw 'Run anahtari bulunamadi; once Windows ayarlarini kontrol edin.'}
   try{if((Read-Entry $key $p.name).exists){throw 'Ayni adla kayit var; uzerine yazilmadi.'};$kind=[Enum]::Parse([Microsoft.Win32.RegistryValueKind],[string]$p.kind);$key.SetValue([string]$p.name,[string]$p.value,$kind);$data=Read-Entry $key $p.name}finally{$key.Dispose()};break
  }
  default{throw 'Desteklenmeyen islem.'}
 }
 @{success=$true;data=$data} | ConvertTo-Json -Depth 10 -Compress
}catch{@{success=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress;exit 1}

