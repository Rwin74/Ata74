module.exports = {
  "profiles": {
    "default": [
      {
        "name": "Genel",
        "args": [
          "-5",
          "--dns-addr",
          "1.1.1.1",
          "--dns-port",
          "53"
        ]
      }
    ],
    "superonline": [
      {
        "name": "Superonline",
        "args": [
          "-9",
          "--dns-addr",
          "1.1.1.1",
          "--dns-port",
          "53"
        ]
      }
    ],
    "kyk_discord": [
      {
        "name": "Yurt Discord",
        "args": [
          "-9",
          "--dns-addr",
          "77.88.8.8",
          "--dns-port",
          "1253"
        ]
      }
    ],
    "kyk_roblox": [
      {
        "name": "Yurt Roblox",
        "args": [
          "-9",
          "--dns-addr",
          "77.88.8.8",
          "--dns-port",
          "1253"
        ]
      }
    ],
    "yurt_auto": [
      {
        "name": "Agresif / alternatif DNS",
        "args": [
          "-9",
          "--dns-addr",
          "77.88.8.8",
          "--dns-port",
          "1253"
        ]
      },
      {
        "name": "Agresif / Cloudflare",
        "args": [
          "-9",
          "--dns-addr",
          "1.1.1.1",
          "--dns-port",
          "53"
        ]
      },
      {
        "name": "Uyumlu parçalama / alternatif DNS",
        "args": [
          "-1",
          "-q",
          "--dns-addr",
          "77.88.8.8",
          "--dns-port",
          "1253"
        ]
      },
      {
        "name": "Otomatik TTL / alternatif DNS",
        "args": [
          "-5",
          "-q",
          "--dns-addr",
          "77.88.8.8",
          "--dns-port",
          "1253"
        ]
      },
      {
        "name": "Agresif / mevcut DNS",
        "args": [
          "-9"
        ]
      }
    ]
  }
};
