# Mapas del Castillo

Mapa interactivo del mundo de la serie *El hombre en el castillo* (1962), con un **globo 3D** al estilo Google Earth, **vuelo en primera persona** y herramientas al estilo de Google Maps:

- **Globo 3D** con estética de película de 1962: arrastra para moverlo, rueda o pellizco para acercar, Mayús + arrastrar (o dos dedos) para girar e inclinar. De cerca se genera una capa de detalle en alta resolución.
- **Primera persona**: vuela sobre el mundo con velocidad, rumbo y altitud; avisa al entrar en el espacio aéreo de cada bloque y marca capitales y lugares de la serie con columnas de luz y su distancia.
- **Viajes en primera persona** desde «Cómo llegar»: cohete Berlín–Nueva York por el borde del espacio, avión, tren o coche.
- Vista de **mapa plano 2D** como alternativa (botón 2D/3D).

- Buscador de ciudades, territorios, bloques y coordenadas (`38.44, -105.24`).
- Ficha de cada lugar y territorio, con su bloque, descripción, coordenadas y lugares cercanos.
- **Cómo llegar** en coche, tren, avión o cohete: distancia, tiempo, fronteras entre bloques y avisos.
- **Medir distancia** con varios puntos, en km y millas náuticas.
- Menú del punto con clic derecho (o mantén pulsado en el móvil): ¿Qué hay aquí?, rutas desde/hasta, guardar, copiar.
- Estilos: Serie, Mapa, Archivo, Noche y Real 1962; capas de fronteras de antes de la guerra, frentes, rutas de cohete, cuadrícula, nubes, día y noche reales y grano de película.
- Guardados (en el navegador), leyenda de bloques, cronología y atajos de teclado.

Abrir `mapa/index.html` desde un servidor web (por ejemplo `npx serve mapa`); como archivo suelto el navegador bloquea la carga de `datos/mundo.json`.

Las fronteras entre bloques son una interpretación aproximada de fans. Costas y fronteras: Natural Earth (dominio público), vía `world-atlas` y `us-atlas`. `herramientas/construir-datos.mjs` regenera `datos/mundo.json`.
