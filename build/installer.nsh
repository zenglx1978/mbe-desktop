; MBE Desktop — Custom NSIS Installer Script
; 可在此处添加自定义安装页面或注册表操作

!macro customInstall
  ; 写入自定义注册表项（可选）
  ; WriteRegStr HKCU "Software\MBE Desktop" "InstallPath" "$INSTDIR"
!macroend

!macro customUnInstall
  ; 清理自定义注册表项（可选）
  ; DeleteRegKey HKCU "Software\MBE Desktop"
!macroend
