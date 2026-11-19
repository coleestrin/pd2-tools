# Run with 32-bit Windows PowerShell: StormLib.dll in the game install is 32-bit.
param([string]$GameRoot = 'C:/Program Files (x86)/Diablo II', [string]$ArchiveDirectory = (Join-Path $GameRoot 'ProjectD2/Live'), [Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
if ([IntPtr]::Size -ne 4) { throw 'Use SysWOW64/WindowsPowerShell/v1.0/powershell.exe' }
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Choose a new output directory to preserve existing extracts.' }
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
$StormLibrary = (Join-Path $GameRoot 'ProjectD2/StormLib.dll').Replace('\', '/')
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Pd2ArchiveReader {
 [DllImport("$StormLibrary",CharSet=CharSet.Ansi,SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] public static extern bool SFileOpenArchive(string path,uint priority,uint flags,out IntPtr archive);
 [DllImport("$StormLibrary",CharSet=CharSet.Ansi,SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] public static extern bool SFileOpenFileEx(IntPtr archive,string path,uint scope,out IntPtr file);
 [DllImport("$StormLibrary")] public static extern uint SFileGetFileSize(IntPtr file,out uint high);
 [DllImport("$StormLibrary",SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] public static extern bool SFileReadFile(IntPtr file,byte[] buffer,uint size,out uint read,IntPtr overlapped);
 [DllImport("$StormLibrary")] [return: MarshalAs(UnmanagedType.I1)] public static extern bool SFileCloseFile(IntPtr file);
 [DllImport("$StormLibrary")] [return: MarshalAs(UnmanagedType.I1)] public static extern bool SFileCloseArchive(IntPtr archive);
}
"@
$qaArchives=@('pd2data.mpq','pd2assets.mpq','pd2monchars.mpq','pd2maps.mpq','patch_d2.mpq' | ForEach-Object { Join-Path $ArchiveDirectory $_ }) + @('patch_d2.mpq','d2exp.mpq','d2data.mpq' | ForEach-Object { Join-Path $GameRoot $_ })
$qaNames=@('MonLvl','Levels','Weapons','CharStats','MonStats','MonStats2','MonProp','MonPreset','SuperUniques','Skills','ItemTypes','Armor','Missiles','SkillDesc','Properties','ItemStatCost','Hireling' | ForEach-Object { "data\global\excel\$_.txt" }) + @('data\global\excel\MonStats.bin','data\global\AnimData.d2','data\local\lng\eng\string.tbl','data\local\lng\eng\expansionstring.tbl','data\local\lng\eng\patchstring.tbl')
$qaManifest=@()
foreach($qaName in $qaNames){foreach($qaArchiveName in $qaArchives){$qaArchive=[IntPtr]::Zero
if(-not [Pd2ArchiveReader]::SFileOpenArchive($qaArchiveName,0,256,[ref]$qaArchive)){continue}
$qaFile=[IntPtr]::Zero
if([Pd2ArchiveReader]::SFileOpenFileEx($qaArchive,$qaName,0,[ref]$qaFile)){$qaHigh=[uint32]0;$qaSize=[Pd2ArchiveReader]::SFileGetFileSize($qaFile,[ref]$qaHigh);$qaBytes=New-Object byte[] $qaSize;$qaRead=[uint32]0
if(-not [Pd2ArchiveReader]::SFileReadFile($qaFile,$qaBytes,$qaSize,[ref]$qaRead,[IntPtr]::Zero)){throw "Read failed: $qaName"}
[IO.File]::WriteAllBytes((Join-Path $OutputDirectory ([IO.Path]::GetFileName($qaName))),$qaBytes)
$qaManifest += [pscustomobject]@{ File=[IO.Path]::GetFileName($qaName); Archive=$qaArchiveName; SHA256=(Get-FileHash -LiteralPath (Join-Path $OutputDirectory ([IO.Path]::GetFileName($qaName))) -Algorithm SHA256).Hash.ToLowerInvariant() }
[void][Pd2ArchiveReader]::SFileCloseFile($qaFile);[void][Pd2ArchiveReader]::SFileCloseArchive($qaArchive);Write-Output "$qaName : $qaRead from $qaArchiveName";break}
[void][Pd2ArchiveReader]::SFileCloseArchive($qaArchive)}}
if ($qaManifest.Count -ne $qaNames.Count) { throw 'One or more required source files were not found; do not use this incomplete extract.' }
$qaManifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'extraction-manifest.json') -Encoding UTF8
