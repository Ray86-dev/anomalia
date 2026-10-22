// D3 · Baltimore, 1951 — Las células de Henrietta Lacks. Narra Mnemósine.
// Hechos del documento de diseño (§5): células de un tumor de Henrietta Lacks, mujer
// afroamericana tratada en el Hospital Johns Hopkins, se extrajeron sin su consentimiento y
// dieron lugar a la línea HeLa. El Cronista es técnico del laboratorio que recibe la muestra.
// Decisión del docente: la escena ocurre cuando llega la muestra, con ella viva y en tratamiento.
// Sensibilidad: Henrietta Lacks no tiene diálogo; se la nombra siempre con respeto.
// Lo marcado con TODO(verificar) no está en el documento de diseño: debe revisarlo el docente.
// Escena breve (M6): título, eco, tres líneas y la pregunta (seis como mucho).

VAR eleccion_d2 = ""
VAR eleccion_d1 = ""

=== escena ===
Baltimore, 1951. # titulo
// Eco (M6): una sola línea que recuerda la decisión del dilema anterior que se haya jugado.
{
- eleccion_d2 == "A":
    Todavía recuerdas Berlín: trabajaste en el programa de gas de Haber. # eco
- eleccion_d2 == "B":
    Todavía recuerdas Berlín: te negaste a fabricar el gas y te marchaste del laboratorio. # eco
- eleccion_d2 == "C":
    Todavía recuerdas Berlín: contaste a todo el mundo lo que se preparaba en el laboratorio. # eco
- eleccion_d1 == "A":
    Todavía recuerdas Roma: aconsejaste a Galileo ceder en público para seguir investigando. # eco
- eleccion_d1 == "B":
    Todavía recuerdas Roma: aconsejaste a Galileo mantenerse firme en público. # eco
- eleccion_d1 == "C":
    Todavía recuerdas Roma: ayudaste a sacar en secreto los escritos de Galileo. # eco
}
Trabajas en un laboratorio del Hospital Johns Hopkins. Ha llegado una muestra: células del tumor de Henrietta Lacks, una mujer afroamericana que recibe tratamiento aquí.
// TODO(verificar): segregación racial en los hospitales de Estados Unidos en 1951.
Nadie le ha pedido permiso. En el Estados Unidos de 1951, la segregación racial llega también a los hospitales.
// TODO(verificar): antes de HeLa, las células humanas no sobrevivían mucho tiempo en cultivo.
Las células humanas mueren a los pocos días en el laboratorio; si estas sobreviven, podrían servir para investigar vacunas durante años. Tú decides qué hacer con la muestra.
¿Se puede investigar con el cuerpo de una persona sin preguntarle? ¿Quién debería beneficiarse de lo que se descubra? # pregunta
-> END
