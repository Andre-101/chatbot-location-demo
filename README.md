# Chatbot Location Demo

Aplicación web para interpretar una operación, usar la ubicación del dispositivo, consultar puntos cercanos y mostrar una ruta.

## Arquitectura

```text
GitHub Pages
  ├─ GET → Google Apps Script
  │          ├─ Google Sheets
  │          └─ Groq
  └─ GET → OSRM
```

La clave de Groq permanece únicamente en las propiedades de Apps Script. El repositorio no contiene secretos ni la base privada.

## Estructura

```text
.
├─ index.html
├─ css/
│  ├─ styles.css
│  └─ map-markers.css
├─ js/
│  ├─ app.js
│  ├─ api.js
│  ├─ config.js
│  ├─ map.js
│  └─ recommendation.js
├─ 404.html
└─ .gitignore
```

## Ejecución local

```bash
python -m http.server 8000
```

Abre `http://localhost:8000`.

## GitHub Pages

```text
Settings → Pages
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

## Funciones

- Interpretación de retiro, depósito, pago y transferencia.
- GPS en dispositivos móviles.
- Búsqueda de puntos cercanos.
- Comparación de recorridos con OSRM.
- Mapa, recomendación y alternativas.
