FROM python:slim-buster

LABEL version="0.2.2"
LABEL repository="https://github.com/alexesprit/action-update-file"
LABEL homepage="https://github.com/alexesprit/action-update-file"
LABEL maintainer="alexesprit <alex.esprit@gmail.com>"

COPY "entrypoint.py" "/entrypoint.py"
COPY "requirements.txt" /

RUN pip install -r requirements.txt

ENTRYPOINT ["/entrypoint.py"]
