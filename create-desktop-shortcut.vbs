' Create PharmaChain desktop shortcut
Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Resolve project path relative to this script
strProjectDir = fso.GetParentFolderName(WScript.ScriptFullName)
strStartBat = strProjectDir & "\start.bat"
strDesktop = WshShell.SpecialFolders("Desktop")
strShortcutPath = strDesktop & "\PharmaChain.lnk"

Set oShortcut = WshShell.CreateShortcut(strShortcutPath)
oShortcut.TargetPath = strStartBat
oShortcut.WorkingDirectory = strProjectDir
oShortcut.Description = "PharmaChain - Pharmacy Supply Chain Management"
oShortcut.IconLocation = strProjectDir & "\public\icons\icon-192x192.png, 0"
oShortcut.Save

If fso.FileExists(strShortcutPath) Then
    WScript.Echo "SUCCESS: Shortcut created at " & strShortcutPath
Else
    WScript.Echo "ERROR: Shortcut was not created."
End If

