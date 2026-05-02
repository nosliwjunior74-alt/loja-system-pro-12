@echo off
cd /d %~dp0
echo Iniciando aplicativo da loja...
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080/index.html
  py -m http.server 8080
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080/index.html
  python -m http.server 8080
  goto :eof
)
echo.
echo Python nao encontrado.
echo Instale Python e marque "Add Python to PATH".
echo Depois execute este arquivo novamente.
pause
