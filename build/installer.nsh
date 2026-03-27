!macro customInit
  ; --- 安装/升级前：终止正在运行的 MBE Desktop ---
  nsExec::ExecToStack 'taskkill /F /IM "MBE Desktop.exe"'
  Sleep 1000

  ; --- 检测并卸载旧 MSI 安装 ---
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{7B3A4F2E-8C1D-4E5F-9A0B-6D2C8E7F1A3B}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到旧版 MBE Desktop (MSI)，需要先卸载才能继续。$\n是否立即卸载旧版本？" IDYES uninstall_msi IDNO abort_install
    abort_install:
      Abort
    uninstall_msi:
      ExecWait 'msiexec /passive /norestart /x {7B3A4F2E-8C1D-4E5F-9A0B-6D2C8E7F1A3B}'
      Sleep 2000
  ${EndIf}

  ; --- 检测旧 per-user NSIS 安装 ---
  ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{com.himaker.mbe-desktop}" "UninstallString"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.himaker.mbe-desktop" "UninstallString"
  ${EndIf}
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到旧版 MBE Desktop (用户安装)，需要先卸载。$\n是否立即卸载？" IDYES uninstall_old IDNO abort_install2
    abort_install2:
      Abort
    uninstall_old:
      ExecWait '$0 /S'
      Sleep 2000
  ${EndIf}
!macroend

!macro customUnInit
  ; --- 卸载前：终止正在运行的 MBE Desktop ---
  nsExec::ExecToStack 'taskkill /F /IM "MBE Desktop.exe"'
  Sleep 1500
!macroend
