[Setup]
AppId={{8F9A27ED-CDB2-456A-B17E-5DB4A3B80A8B}}
AppName=IGA Gestao Desktop
AppVersion=1.2.0
AppPublisher=IGA Automação & Tecnologia
; Instalação por usuário (sem UAC). Evita AppLocker/SRP que bloqueiam Program Files
; e o SmartScreen "bloquear" configurado por admins corporativos. Mesmo padrão
; usado por Slack, Discord, VS Code e Teams.
DefaultDirName={userpf}\IGA Gestao Desktop
DefaultGroupName=IGA Gestao Desktop
DisableProgramGroupPage=yes
OutputDir=release
OutputBaseFilename=IGA-Gestao-Desktop-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=..\installer\assets\logo.ico
UninstallDisplayIcon={app}\IGA Gestao.exe
WizardStyle=modern
; Evita erros "file in use" em re-instalação quando o app está aberto.
CloseApplications=yes
CloseApplicationsFilter=IGA Gestao.exe
RestartApplications=no

; =====================================================================
; ASSINATURA DIGITAL — distribuindo SEM certificado
; =====================================================================
; Este instalador é distribuído NÃO-ASSINADO. Consequências:
;   - Na primeira execução, Windows SmartScreen mostra
;     "Windows protegeu seu PC" e esconde o botão "Executar".
;   - Cliente precisa clicar "Mais informações" → "Executar assim mesmo".
;   - Alguns antivírus podem quarentenar o .exe até whitelist manual.
;
; Caso futuro contrate certificado Code Signing, descomente:
;   SignTool=signtool
;   SignedUninstaller=yes
; E cadastre no Inno Setup em "Ferramentas → Configurar Ferramentas de Assinatura".

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "release\IGA Gestao-win32-x64\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\IGA Gestao Desktop"; Filename: "{app}\IGA Gestao.exe"; WorkingDir: "{app}"; IconFilename: "{app}\IGA Gestao.exe"
Name: "{autodesktop}\IGA Gestao Desktop"; Filename: "{app}\IGA Gestao.exe"; Tasks: desktopicon; IconFilename: "{app}\IGA Gestao.exe"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos adicionais:"

[Run]
Filename: "{app}\IGA Gestao.exe"; Description: "Executar IGA Gestao agora"; Flags: nowait postinstall skipifsilent

; Dados do usuário (users.json, datasources.json, logs) moram em %APPDATA%\IGA Gestao Desktop\
; NÃO são removidos automaticamente — só depois de confirmação no [Code] abaixo.
[UninstallDelete]
Type: filesandordirs; Name: "{app}\backend\data"

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  AppDataPath: String;
  ResponseCode: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    { Electron usa o `name` do package.json (lowercase + dashes) como pasta de userData. }
    AppDataPath := ExpandConstant('{userappdata}') + '\iga-gestao-desktop';
    if DirExists(AppDataPath) then
    begin
      ResponseCode := MsgBox(
        'Remover também os dados do usuário (contas, fontes de dados, logs)?' #13#10 #13#10 +
        'Pasta: ' + AppDataPath + #13#10 #13#10 +
        'Clique "Não" para preservar (útil em reinstalação/upgrade).',
        mbConfirmation,
        MB_YESNO or MB_DEFBUTTON2
      );
      if ResponseCode = IDYES then
      begin
        DelTree(AppDataPath, True, True, True);
      end;
    end;
  end;
end;
