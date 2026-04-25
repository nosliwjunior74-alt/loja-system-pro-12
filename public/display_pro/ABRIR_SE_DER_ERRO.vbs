Set oWS = CreateObject("WScript.Shell")
sPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
oWS.Run Chr(34) & sPath & "\index.html" & Chr(34), 1, False
