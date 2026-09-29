param(
  [Parameter(Mandatory=$true)][ValidateSet("set","get")] [string] $Action,
  [Parameter(Mandatory=$true)] [string] $Target,
  [string] $UserName = ""
)

$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredWrite([In] ref CREDENTIAL userCredential, [In] UInt32 flags);

  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", EntryPoint="CredFree", SetLastError=true)]
  public static extern bool CredFree([In] IntPtr cred);
}
"@

Add-Type $source -ErrorAction SilentlyContinue

$CRED_TYPE_GENERIC = 1
$CRED_PERSIST_LOCAL_MACHINE = 2

if ($Action -eq "set") {
  $secret = [Console]::In.ReadToEnd()
  $bytes = [Text.Encoding]::Unicode.GetBytes($secret)
  $blob = [Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
  $cred = New-Object WinCred+CREDENTIAL
  $cred.Type = $CRED_TYPE_GENERIC
  $cred.TargetName = $Target
  $cred.CredentialBlobSize = $bytes.Length
  $cred.CredentialBlob = $blob
  $cred.Persist = $CRED_PERSIST_LOCAL_MACHINE
  $cred.UserName = $UserName
  $ok = [WinCred]::CredWrite([ref]$cred, 0)
  [Runtime.InteropServices.Marshal]::FreeCoTaskMem($blob)
  if (-not $ok) { throw "CredWrite failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  "ok"
  exit 0
}

$ptr = [IntPtr]::Zero
$readOk = [WinCred]::CredRead($Target, $CRED_TYPE_GENERIC, 0, [ref]$ptr)
if (-not $readOk) { throw "CredRead failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
$cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][WinCred+CREDENTIAL])
$password = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.CredentialBlob, [int]($cred.CredentialBlobSize / 2))
[WinCred]::CredFree($ptr) | Out-Null
Write-Output $password
