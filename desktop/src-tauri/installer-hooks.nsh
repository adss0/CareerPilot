; Extra steps for the Windows installer (Tauri's NSIS hooks).

; Installing a new version over an old one runs the old uninstaller first, and its window has a
; "Delete the application data" box. That folder holds the database, CVs, letters and keys, so
; a tick there by mistake would lose everything. Ask once more, with "No" as the default.
; Updates never delete it (the template skips it in update mode), and neither does "No".
; A silent uninstall that asked for it with /DELETEAPPDATA still gets it.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
      "This deletes all your CareerPilot data: your jobs, CVs, cover letters, settings and keys. It can't be undone.$\r$\n$\r$\nDelete it?" \
      /SD IDYES IDYES careerpilot_delete_data
    StrCpy $DeleteAppDataCheckboxState 0
    careerpilot_delete_data:
  ${EndIf}
!macroend
