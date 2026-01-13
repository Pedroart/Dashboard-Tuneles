## En tu PC con WIN activa la ejecucion de escript

Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Ejecutar Sistema

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt


uvicorn main:app --reload


# Guarda Cambios

pip freeze > requirements.txt
