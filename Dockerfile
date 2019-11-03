FROM python:3.7-buster

LABEL version="0.1.0"
LABEL repository="https://github.com/alexesprit/action-update-file"
LABEL homepage="https://github.com/alexesprit/action-update-file"
LABEL maintainer="alexesprit <alex.esprit@gmail.com>"

LABEL com.github.actions.name="Update file on GitHub"
LABEL com.github.actions.description="Update (i.e. commit and push) a given file on GitHub"
LABEL com.github.actions.icon="git-commit"
LABEL com.github.actions.color="green"

COPY "entrypoint.py" "/entrypoint.py"
COPY "requirements.txt" /

RUN pip install -r requirements.txt

ENTRYPOINT ["/entrypoint.py"]
