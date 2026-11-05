# Mapas del Castillo

Mapa interactivo del mundo de la serie *El hombre en el castillo* (1962), con herramientas al estilo de Google Maps:

- Buscador de ciudades, territorios, bloques y coordenadas (`38.44, -105.24`).
- Ficha de cada lugar y territorio, con su bloque, descripción, coordenadas y lugares cercanos.
- **Cómo llegar** en coche, tren, avión o cohete: distancia, tiempo, fronteras entre bloques y avisos.
- **Medir distancia** con varios puntos, en km y millas náuticas.
- Menú del punto con clic derecho (o mantén pulsado en el móvil): ¿Qué hay aquí?, rutas desde/hasta, guardar, copiar.
- Capas: Mapa, Archivo, Noche y Real 1962; fronteras de antes de la guerra, frentes, rutas de cohete y cuadrícula.
- Guardados (en el navegador), leyenda de bloques, cronología y atajos de teclado.

Abrir `mapa/index.html` desde un servidor web (por ejemplo `npx serve mapa`); como archivo suelto el navegador bloquea la carga de `datos/mundo.json`.

Las fronteras entre bloques son una interpretación aproximada de fans. Costas y fronteras: Natural Earth (dominio público), vía `world-atlas` y `us-atlas`. `herramientas/construir-datos.mjs` regenera `datos/mundo.json`.
