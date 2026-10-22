// D2 en lectura fácil (D-10). Mismos hechos que dilemas/d2-haber.ink, en frases cortas.
// Sensibilidad: no se menciona la muerte de Clara Immerwahr.

VAR eleccion_d1 = ""

=== escena ===
Berlín, 1915. # titulo
// Eco (M6): una sola línea que recuerda la decisión del dilema anterior que se haya jugado.
{
- eleccion_d1 == "A":
    Te acuerdas de Roma: le dijiste a Galileo que cediera para seguir investigando. # eco
- eleccion_d1 == "B":
    Te acuerdas de Roma: le dijiste a Galileo que defendiera lo que pensaba. # eco
- eleccion_d1 == "C":
    Te acuerdas de Roma: sacaste en secreto los escritos de Galileo. # eco
}
// TODO(verificar): Primera Guerra Mundial en curso en 1915.
Hay una guerra en Europa. Trabajas con el químico Fritz Haber. Su amoníaco sirve para hacer abono y dar de comer a millones de personas.
Ahora el ejército quiere un gas venenoso para la guerra. Haber dirige ese trabajo. Clara Immerwahr, química y esposa de Haber, no lo quiere.
Tienes que decidir qué haces tú.
La ciencia puede servir para cosas buenas y para cosas malas. ¿Quién responde de cómo se usa? # pregunta
-> END
