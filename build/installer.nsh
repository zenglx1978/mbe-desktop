!macro customInit
  ; --- 安装/升级前：终止正在运行的 MBE Desktop ---
  nsExec::ExecToStack 'taskkill /F /IM "MBE Desktop.exe"'
  Sleep 1500

  ; --- 检测并卸载旧 MSI 安装 ---
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{7B3A4F2E-8C1D-4E5F-9A0B-6D2C8E7F1A3B}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到旧版 MBE Desktop (MSI)，需要先卸载才能继续。$\n是否立即卸载旧版本？" /SD IDYES IDYES uninstall_msi IDNO abort_msi
    abort_msi:
      Abort
    uninstall_msi:
      ExecWait 'msiexec /passive /norestart /x {7B3A4F2E-8C1D-4E5F-9A0B-6D2C8E7F1A3B}'
      Sleep 3000
      ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{7B3A4F2E-8C1D-4E5F-9A0B-6D2C8E7F1A3B}" "UninstallString"
      ${If} $0 != ""
        MessageBox MB_OK|MB_ICONEXCLAMATION "旧版 MSI 卸载未完成，请手动卸载后重试。"
        Abort
      ${EndIf}
  ${EndIf}

  ; --- 检测已有 per-machine NSIS 安装 ---
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "UninstallString"
  ${If} $0 != ""
    ReadRegStr $1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "DisplayVersion"
    ${If} $1 != ""
      MessageBox MB_YESNO|MB_ICONINFORMATION "检测到已安装 MBE Desktop v$1。$\n$\n点击「是」将自动卸载旧版本并安装新版本。$\n点击「否」取消安装。" /SD IDYES IDYES upgrade_nsis IDNO abort_nsis
    ${Else}
      MessageBox MB_YESNO|MB_ICONINFORMATION "检测到已安装 MBE Desktop。$\n$\n点击「是」将自动卸载旧版本并安装新版本。$\n点击「否」取消安装。" /SD IDYES IDYES upgrade_nsis IDNO abort_nsis
    ${EndIf}
    abort_nsis:
      Abort
    upgrade_nsis:
      ReadRegStr $4 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "InstallLocation"

      ; Strip surrounding quotes from UninstallString
      StrCpy $2 $0 1
      ${If} $2 == '"'
        StrCpy $0 $0 "" 1
        StrLen $2 $0
        IntOp $2 $2 - 1
        StrCpy $0 $0 $2
      ${EndIf}

      ; Copy uninstaller to temp so _?= can work and self-deletion succeeds
      Delete "$TEMP\_mbe_old_uninstall.exe"
      CopyFiles /SILENT "$0" "$TEMP\_mbe_old_uninstall.exe"

      ; _?= makes ExecWait synchronous (uninstaller won't fork to temp)
      ${If} $4 != ""
        ExecWait '"$TEMP\_mbe_old_uninstall.exe" /S _?=$4'
      ${Else}
        ExecWait '"$TEMP\_mbe_old_uninstall.exe" /S'
      ${EndIf}
      Delete "$TEMP\_mbe_old_uninstall.exe"
      Sleep 3000

      ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "UninstallString"
      ${If} $0 != ""
        MessageBox MB_OK|MB_ICONEXCLAMATION "旧版本卸载未完成，请手动卸载后重试。"
        Abort
      ${EndIf}
  ${EndIf}

  ; --- 检测旧 per-user NSIS 安装 ---
  ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到旧版 MBE Desktop (用户安装)，需要先卸载。$\n是否立即卸载？" /SD IDYES IDYES uninstall_user IDNO abort_user
    abort_user:
      Abort
    uninstall_user:
      ReadRegStr $4 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "InstallLocation"

      ; Strip surrounding quotes from UninstallString
      StrCpy $2 $0 1
      ${If} $2 == '"'
        StrCpy $0 $0 "" 1
        StrLen $2 $0
        IntOp $2 $2 - 1
        StrCpy $0 $0 $2
      ${EndIf}

      Delete "$TEMP\_mbe_old_uninstall.exe"
      CopyFiles /SILENT "$0" "$TEMP\_mbe_old_uninstall.exe"

      ${If} $4 != ""
        ExecWait '"$TEMP\_mbe_old_uninstall.exe" /S _?=$4'
      ${Else}
        ExecWait '"$TEMP\_mbe_old_uninstall.exe" /S'
      ${EndIf}
      Delete "$TEMP\_mbe_old_uninstall.exe"
      Sleep 3000

      ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "UninstallString"
      ${If} $0 != ""
        MessageBox MB_OK|MB_ICONEXCLAMATION "旧版本卸载未完成，请手动卸载后重试。"
        Abort
      ${EndIf}
  ${EndIf}
!macroend

!macro customUnInit
  ; --- 卸载前：终止正在运行的 MBE Desktop ---
  nsExec::ExecToStack 'taskkill /F /IM "MBE Desktop.exe"'
  Sleep 1500
!macroend
