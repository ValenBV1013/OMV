#!/bin/bash
python manage.py makemigrations MovAI api
python manage.py migrate
python manage.py runserver 0.0.0.0:8000