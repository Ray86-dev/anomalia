// D4 · Shenzhen, 2018 — Los primeros bebés editados con CRISPR. Narra Mnemósine.
// Hechos del documento de diseño (§5): en 2018 un investigador anunció el nacimiento de dos
// gemelas con el gen CCR5 editado para protegerlas del VIH. El Cronista es un colega ficticio
// al que se consulta antes de la implantación.
// Sensibilidad: el investigador real no habla ni se nombra en la escena (solo en el Archivo real).
// Lo marcado con TODO(verificar) no está en el documento de diseño: debe revisarlo el docente.
// Escena breve (M6): título, eco, tres líneas y la pregunta (seis como mucho).

VAR eleccion_d3 = ""
VAR eleccion_d2 = ""

=== escena ===
Shenzhen, 2018. # titulo
// Eco (M6): una sola línea que recuerda la decisión del dilema anterior que se haya jugado.
{
- eleccion_d3 == "A":
    Todavía recuerdas Baltimore: usaste las células de Henrietta Lacks sin pedirle permiso. # eco
- eleccion_d3 == "B":
    Todavía recuerdas Baltimore: no usaste las células hasta pedirle permiso a Henrietta Lacks. # eco
- eleccion_d3 == "C":
    Todavía recuerdas Baltimore: usaste las células, pero pediste informar a Henrietta Lacks y compartir los beneficios. # eco
- eleccion_d2 == "A":
    Todavía recuerdas Berlín: trabajaste en el programa de gas de Haber. # eco
- eleccion_d2 == "B":
    Todavía recuerdas Berlín: te negaste a fabricar el gas y te marchaste del laboratorio. # eco
- eleccion_d2 == "C":
    Todavía recuerdas Berlín: contaste a todo el mundo lo que se preparaba en el laboratorio. # eco
}
// TODO(verificar): CRISPR existe desde 2012 (dato de la ficha de Gattaca del docente).
Eres científico en un laboratorio de genética. Desde hace pocos años existe CRISPR, una técnica que permite cambiar genes con mucha precisión.
// Línea germinal: el cambio está en todas las células y pasa a la descendencia.
Un investigador te enseña su plan en secreto: ha editado embriones humanos para que los bebés no puedan infectarse con el VIH. Si nacen, sus hijos heredarán el cambio.
Nadie sabe qué otros efectos puede tener a lo largo de una vida. Te pide tu opinión antes de seguir adelante.
¿Se debe hacer todo lo que la ciencia puede hacer? ¿Dónde está la línea entre curar y mejorar? # pregunta
-> END
