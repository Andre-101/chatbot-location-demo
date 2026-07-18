# Chatbot Location Demo

Prototipo web estático para interpretar una operación, obtener la ubicación del navegador, consultar puntos cercanos desde Google Apps Script y mostrar una ruta estimada con OSRM.

## Arquitectura

```text
GitHub Pages
  ├─ GET → Google Apps Script
  │          ├─ Google Sheets
  │          └─ Groq (POST interno)
  └─ GET → OSRM
```

La clave de Groq permanece únicamente en las propiedades del proyecto de Apps Script. Este repositorio no contiene secretos ni la base privada.

## Estructura

```text
.
├─ index.html
├─ css/styles.css
├─ js/
│  ├─ app.js
│  ├─ api.js
│  ├─ config.js
│  ├─ map.js
│  └─ recommendation.js
├─ 404.html
└─ .gitignore
```

## Configuración pública

La URL pública de Apps Script y el endpoint de OSRM están en `js/config.js`.

## Ejecución local

Los módulos ES no deben abrirse directamente con `file://`. Inicia un servidor local, por ejemplo:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

## GitHub Pages

Configura:

```text
Settings → Pages
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

## Estado del MVP

- Consulta de salud de Apps Script.
- Permiso de geolocalización del navegador.
- Interpretación de retiro, depósito, pago y transferencia.
- Búsqueda de candidatos cercanos.
- Comparación básica mediante OSRM.
- Mapa Leaflet, recomendación y alternativas.

## Limitaciones

Es una demostración. La actividad, capacidad transaccional, horarios y vigencia de cada punto deben verificarse antes de una operación real. No introduzcas datos personales, credenciales o información financiera sensible.
