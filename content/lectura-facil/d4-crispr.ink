// D4 en lectura fácil (D-10). Mismos hechos que dilemas/d4-crispr.ink, en frases cortas.
// Sensibilidad: el investigador real no habla ni se nombra en la escena.

VAR eleccion_d3 = ""
VAR eleccion_d2 = ""

=== escena ===
Shenzhen, China, 2018. # titulo
// Eco (M6): una sola línea que recuerda la decisión del dilema anterior que se haya jugado.
{
- eleccion_d3 == "A":
    Te acuerdas de Baltimore: usaste las células de Henrietta Lacks sin preguntarle. # eco
- eleccion_d3 == "B":
    Te acuerdas de Baltimore: esperaste a pedirle permiso a Henrietta Lacks. # eco
- eleccion_d3 == "C":
    Te acuerdas de Baltimore: usaste las células, pero quisiste contárselo a Henrietta Lacks. # eco
- eleccion_d2 == "A":
    Te acuerdas de Berlín: ayudaste a fabricar el gas. # eco
- eleccion_d2 == "B":
    Te acuerdas de Berlín: dijiste que no y te fuiste del laboratorio. # eco
- eleccion_d2 == "C":
    Te acuerdas de Berlín: contaste a todos lo que se preparaba. # eco
}
// TODO(verificar): CRISPR existe desde 2012.
Eres científico en un laboratorio de genética. Hace pocos años se inventó CRISPR, una técnica para cambiar los genes.
Un compañero te cuenta un secreto: ha cambiado los genes de unos embriones para que los bebés no se contagien del VIH. Si nacen, sus hijos también tendrán el cambio.
Nadie sabe qué otros efectos puede tener. Te pide tu opinión antes de seguir.
¿Hay que hacer todo lo que la ciencia puede hacer? ¿Dónde está el límite entre curar y mejorar? # pregunta
-> END
