; Extra steps for the Windows installer (Tauri's NSIS hooks).

; The engine (careerpilot-server.exe) runs as two processes: a small launcher and the engine
; itself. Versions up to 1.10.3 stopped only the launcher before an update, so the engine kept
; its .exe locked and the update couldn't replace it: the old version stayed installed and the
; app didn't reopen. Close every copy before files are copied or deleted, and give Windows a
; moment to release the file. /T takes child processes too. Harmless when nothing is running.
!macro CAREERPILOT_STOP_ENGINE
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM careerpilot-server.exe'
  Pop $0
  Sleep 1500
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro CAREERPILOT_STOP_ENGINE
!macroend

; Installing a new version over an old one runs the old uninstaller first, and its window has a
; "Delete the application data" box. That folder holds the database, CVs, letters and keys, so
; a tick there by mistake would lose everything. Ask once more, with "No" as the default.
; Updates never delete it (the template skips it in update mode), and neither does "No".
; A silent uninstall that asked for it with /DELETEAPPDATA still gets it.
!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro CAREERPILOT_STOP_ENGINE
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
      "This deletes all your CareerPilot data: your jobs, CVs, cover letters, settings and keys. It can't be undone.$\r$\n$\r$\nDelete it?" \
      /SD IDYES IDYES careerpilot_delete_data
    StrCpy $DeleteAppDataCheckboxState 0
    careerpilot_delete_data:
  ${EndIf}
!macroend
