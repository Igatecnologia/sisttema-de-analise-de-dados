; =====================================================================
;  IGA Gestão — instalador Windows (Inno Setup 6)
;
;  Gera um .exe único que:
;    - Copia binários para C:\Program Files\IgaGestao\
;    - Copia dados iniciais (users/datasources) para C:\ProgramData\IgaGestao\data\
;    - (Opcional) instala serviço Windows via NSSM
;    - Cria atalhos no Menu Iniciar e (opcional) desktop
;    - Inclui Node.js runtime embutido (sem dependência externa)
;
;  Pré-requisitos na máquina de build:
;    1. Inno Setup 6 (https://jrsoftware.org/isdl.php) com ISCC no PATH.
;    2. `build-windows.bat` já rodado — precisa existir `..\dist-windows\`.
;    3. `nssm.exe` (64-bit) em `installer\nssm\` — baixar de https://nssm.cc/download.
;
;  Build:
;    iscc installer.iss
; =====================================================================

#define MyAppName       "IGA Gestão"
#define MyAppVersion    "1.0.0"
#define MyAppPublisher  "IGA"
#define MyAppURL        "http://localhost:3001"
#define MyAppExeName    "start.bat"
#define MyServiceName   "IgaGestao"

[Setup]
AppId={{C9E8D1A6-4F9B-4B5B-8F2A-7A1C3D0E2B11}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\IgaGestao
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=IgaGestao-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
SetupIconFile=assets\logo.ico
UninstallDisplayIcon={app}\logo.ico
SetupLogging=yes
LanguageDetectionMethod=locale

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english";             MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos adicionais:"
Name: "installservice"; Description: "Instalar como serviço do Windows (inicia automaticamente no boot)"; GroupDescription: "Serviço:"; Flags: unchecked

[Files]
; Binários do backend (Node compilado) + frontend estático
Source: "..\dist-windows\back-end-gest-o\*"; DestDir: "{app}\back-end-gest-o"; Flags: recursesubdirs createallsubdirs ignoreversion
; Launcher manual
Source: "start.bat"; DestDir: "{app}"; Flags: ignoreversion
; Runtime Node.js embutido
Source: "runtime\node\*"; DestDir: "{app}\runtime\node"; Flags: recursesubdirs createallsubdirs ignoreversion
; Icone do aplicativo/instalador
Source: "assets\logo.ico"; DestDir: "{app}"; Flags: ignoreversion
; NSSM — wrapper de serviço
Source: "nssm\nssm.exe"; DestDir: "{app}\tools"; Flags: ignoreversion
; Documentação de instalação
Source: "..\INSTALACAO_WINDOWS.md"; DestDir: "{app}"; Flags: ignoreversion isreadme
; Dados iniciais (só no 1º install — nunca sobrescrever)
Source: "..\dist-windows\back-end-gest-o\data\*"; DestDir: "{commonappdata}\IgaGestao\data"; Flags: onlyifdoesntexist uninsneveruninstall

[Dirs]
Name: "{commonappdata}\IgaGestao"; Permissions: users-modify
Name: "{commonappdata}\IgaGestao\data"; Permissions: users-modify
Name: "{commonappdata}\IgaGestao\logs"; Permissions: users-modify

[Icons]
Name: "{group}\Abrir IGA Gestão";    Filename: "{#MyAppURL}"
Name: "{group}\Iniciar (manual)";    Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\Parar serviço";       Filename: "{app}\tools\nssm.exe"; Parameters: "stop {#MyServiceName}"; Tasks: installservice
Name: "{group}\Iniciar serviço";     Filename: "{app}\tools\nssm.exe"; Parameters: "start {#MyServiceName}"; Tasks: installservice
Name: "{group}\Desinstalar";         Filename: "{uninstallexe}"
Name: "{autodesktop}\IGA Gestão";    Filename: "{#MyAppURL}"; Tasks: desktopicon

[Run]
; Registra serviço — `code:GetNodePath` devolve caminho completo para node.exe
Filename: "{app}\tools\nssm.exe"; Parameters: "install {#MyServiceName} ""{code:GetNodePath}"" ""{app}\back-end-gest-o\dist\server.js"""; Tasks: installservice; StatusMsg: "Registrando serviço Windows..."; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "set {#MyServiceName} AppDirectory ""{app}\back-end-gest-o"""; Tasks: installservice; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "set {#MyServiceName} AppEnvironmentExtra NODE_ENV=production IGA_DATA_DIR=""{commonappdata}\IgaGestao\data"""; Tasks: installservice; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "set {#MyServiceName} AppStdout ""{commonappdata}\IgaGestao\logs\out.log"""; Tasks: installservice; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "set {#MyServiceName} AppStderr ""{commonappdata}\IgaGestao\logs\err.log"""; Tasks: installservice; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "set {#MyServiceName} DisplayName ""IGA Gestão"""; Tasks: installservice; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "set {#MyServiceName} Description ""Servidor IGA Gestão — http://localhost:3001"""; Tasks: installservice; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "set {#MyServiceName} Start SERVICE_AUTO_START"; Tasks: installservice; Flags: runhidden
Filename: "{app}\tools\nssm.exe"; Parameters: "start {#MyServiceName}"; Tasks: installservice; StatusMsg: "Iniciando serviço..."; Flags: runhidden
; Ação final: abrir no navegador
Filename: "{#MyAppURL}"; Description: "Abrir IGA Gestão agora"; Flags: postinstall shellexec skipifsilent nowait

[UninstallRun]
; Remove serviço se estiver instalado (falha silenciosa se não existir)
Filename: "{app}\tools\nssm.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden skipifdoesntexist; RunOnceId: "stopService"
Filename: "{app}\tools\nssm.exe"; Parameters: "remove {#MyServiceName} confirm"; Flags: runhidden skipifdoesntexist; RunOnceId: "removeService"

[UninstallDelete]
; Não remove ProgramData — dados do usuário devem sobreviver à desinstalação.
; Para remover manualmente: deletar C:\ProgramData\IgaGestao\

[Code]
// Prioriza o Node embutido no instalador; fallback para Node do sistema.
function GetNodePath(Param: string): string;
var
  BundledNodePath: string;
  NodePath: string;
begin
  BundledNodePath := ExpandConstant('{app}\runtime\node\node.exe');
  if FileExists(BundledNodePath) then
    Result := BundledNodePath
  else if RegQueryStringValue(HKLM64, 'SOFTWARE\Node.js', 'InstallPath', NodePath) and (NodePath <> '') then
    Result := AddBackslash(NodePath) + 'node.exe'
  else if RegQueryStringValue(HKLM,   'SOFTWARE\Node.js', 'InstallPath', NodePath) and (NodePath <> '') then
    Result := AddBackslash(NodePath) + 'node.exe'
  else
    Result := ExpandConstant('{sys}') + '\node.exe';
end;

// Com runtime embutido, não exigimos pré-requisito externo.
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

// Pergunta se quer preservar dados ao desinstalar
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: string;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{commonappdata}\IgaGestao');
    if DirExists(DataDir) then
    begin
      if MsgBox('Deseja remover também os dados do IGA Gestão?' + #13#10 + #13#10 +
                'Isto APAGA permanentemente usuários, fontes de dados e logs em:' + #13#10 + DataDir + #13#10 + #13#10 +
                'Escolha "Não" para preservá-los (útil se for reinstalar).',
                mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;
  end;
end;
