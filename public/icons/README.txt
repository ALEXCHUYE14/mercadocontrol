Coloca aquí los iconos PWA:
  - icon-192.png            (192x192)
  - icon-512.png            (512x512)
  - icon-maskable-512.png   (512x512, con margen de seguridad "maskable")

Puedes generarlos rápidamente desde un logo con:
  https://www.pwabuilder.com/imageGenerator
o con la CLI "pwa-asset-generator".

El generador del proyecto crea placeholders SVG->PNG si tienes 'sharp' o
'imagemagick' disponible; de lo contrario la app funciona igual, solo sin icono.
