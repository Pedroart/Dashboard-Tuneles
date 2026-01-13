## En tu PC con WIN activa la ejecucion de escript

Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Ejecutar Sistema

python -m venv venv
venv\Scripts\activate

uvicorn main:app --reload