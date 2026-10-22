// D3 en lectura fácil (D-10). Mismos hechos que dilemas/d3-lacks.ink, en frases cortas.
// Sensibilidad: Henrietta Lacks no tiene diálogo; se la nombra siempre con respeto.

VAR eleccion_d2 = ""
VAR eleccion_d1 = ""

=== escena ===
Baltimore, 1951. # titulo
// Eco (M6): una sola línea que recuerda la decisión del dilema anterior que se haya jugado.
{
- eleccion_d2 == "A":
    Te acuerdas de Berlín: ayudaste a fabricar el gas. # eco
- eleccion_d2 == "B":
    Te acuerdas de Berlín: dijiste que no y te fuiste del laboratorio. # eco
- eleccion_d2 == "C":
    Te acuerdas de Berlín: contaste a todos lo que se preparaba. # eco
- eleccion_d1 == "A":
    Te acuerdas de Roma: le dijiste a Galileo que cediera para seguir investigando. # eco
- eleccion_d1 == "B":
    Te acuerdas de Roma: le dijiste a Galileo que defendiera lo que pensaba. # eco
- eleccion_d1 == "C":
    Te acuerdas de Roma: sacaste en secreto los escritos de Galileo. # eco
}
Trabajas en el laboratorio de un hospital de Estados Unidos. Hoy han llegado células del tumor de Henrietta Lacks, una mujer afroamericana que recibe tratamiento aquí.
// TODO(verificar): segregación racial en los hospitales de Estados Unidos en 1951.
Nadie le ha pedido permiso. En esa época, a las personas negras se las separaba también en los hospitales.
// TODO(verificar): antes de HeLa, las células humanas no sobrevivían mucho tiempo en cultivo.
Las células humanas mueren pronto en el laboratorio. Si estas viven, pueden ayudar a investigar vacunas. Tú decides qué hacer.
¿Se puede investigar con el cuerpo de alguien sin preguntarle? ¿Quién debe ganar con lo que se descubra? # pregunta
-> END
