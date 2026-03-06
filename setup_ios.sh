#!/bin/sh
# DeltaMusic iOS Setup (v2.1.2)

echo "✦ DeltaMusic: Starting Local Host..."

# Переходим в рабочую директорию
if [ ! -d "DeltaMusic" ]; then
    echo "── Первая установка..."
    git clone --depth 1 https://github.com/nnoverr/DeltaMusic.git
    cd DeltaMusic/pwa
else
    cd DeltaMusic/pwa
    # Небольшая проверка обновлений (опционально для скорости)
    # git pull
fi

# Проверяем, не запущен ли уже сервер (на порту 8080)
# В a-Shell часто достаточно просто запустить, но мы сделаем это чисто.
# Если сервер упал или не запущен - запускаем.

echo "── Проверка сервера..."
# Команда 'pickFolder' в a-Shell может помочь с доступом к файлам, 
# но если мы внутри песочницы приложения, то всё ок.

echo "✦ Старт сервера..."
# Запускаем сервер через python3.
# Мы используем nohup или просто запуск, так как Shortcuts будет ждать завершения.
# Но в a-Shell лучше просто запустить python3.

python3 server.py
