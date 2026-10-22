// D2 · Berlín, 1915 — Fritz Haber y la química de la guerra. Narra Mnemósine.
// Hechos del documento de diseño (§5): síntesis del amoníaco (Haber–Bosch), que permitió
// fertilizantes a escala masiva; en 1915 Haber dirigió el programa alemán de gas cloro (Ypres);
// Clara Immerwahr, química y su esposa, se oponía. El Cronista es químico de su equipo.
// Sensibilidad: no se menciona la muerte de Clara Immerwahr. Nadie tiene frases entre comillas.
// Lo marcado con TODO(verificar) no está en el documento de diseño: debe revisarlo el docente.
// Escena breve (M6): título, eco, tres líneas y la pregunta (seis como mucho).

VAR eleccion_d1 = ""

=== escena ===
Berlín, 1915. # titulo
// Eco (M6): una sola línea que recuerda la decisión del dilema anterior que se haya jugado.
{
- eleccion_d1 == "A":
    Todavía recuerdas Roma: aconsejaste a Galileo ceder en público para seguir investigando. # eco
- eleccion_d1 == "B":
    Todavía recuerdas Roma: aconsejaste a Galileo mantenerse firme en público. # eco
- eleccion_d1 == "C":
    Todavía recuerdas Roma: ayudaste a sacar en secreto los escritos de Galileo. # eco
}
// TODO(verificar): Primera Guerra Mundial en curso en 1915; el amoníaco se obtiene a partir del nitrógeno del aire.
Europa está en guerra. Eres químico en el laboratorio de Fritz Haber, que descubrió cómo fabricar amoníaco a partir del aire: abono para alimentar a millones de personas.
Ahora el ejército le ha encargado un gas venenoso para el frente, y él dirige el programa. Clara Immerwahr, química y esposa de Haber, se opone.
El mismo saber que puede dar de comer a millones puede servir para matar. Tienes que decidir qué haces tú.
¿Es neutral la ciencia? ¿Quién responde de cómo se usa lo que se descubre? # pregunta
-> END
