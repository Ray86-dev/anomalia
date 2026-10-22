// D5 · Canarias, 2077 — La Ley del Genoma. Narra Mnemósine.
// Escena dinámica (§5): cambia según el estado del mundo y las ramas abiertas.
// El juego pasa poder, responsabilidad, equidad, confianza, desnivel y rama_<id>
// (por ejemplo, rama_d1_firme) antes de narrar; si no, valen lo que se declara aquí.
// Ficción: el 2077, el Consejo de Canarias y la Ley del Genoma son inventados.
// Lo marcado con TODO(verificar) no está en el documento de diseño: debe revisarlo el docente.
// Escena breve (M6): el mundo y una sola consecuencia, por orden de prioridad (seis líneas como mucho).

VAR equidad = 50
VAR confianza = 50
VAR desnivel = 0
VAR rama_d1_firme = false
VAR rama_d2_denuncia = false

=== escena ===
Canarias, 2077. # titulo
{
- desnivel >= 25:
    Has vuelto a tu tiempo. Aquí casi todo el mundo tiene su perfil genético, y muchas empresas y centros de estudio ya piden verlo.
- desnivel >= 10:
    Has vuelto a tu tiempo. Los perfiles genéticos son cada vez más comunes, y algunas empresas ya preguntan por ellos.
- else:
    Has vuelto a tu tiempo. Los perfiles genéticos existen, pero casi nadie los usa fuera de los hospitales.
}
{
- equidad < 40:
    Las clínicas de mejora genética son caras. Solo quien puede pagarlas las usa.
- confianza < 35:
    Mucha gente ya no se fía de lo que dicen los científicos.
- rama_d2_denuncia:
    Desde que un químico se atrevió a hablar en 1915, hay leyes que protegen a quien denuncia un peligro.
- rama_d1_firme:
    En las escuelas todavía se cuenta cómo Galileo no se dejó doblar.
}
// TODO(verificar): mito de los metales de Platón (La República), trabajado en clase con Gattaca.
Hace más de 2.400 años, Platón imaginó una ciudad en la que un metal en el alma (oro, plata, bronce o hierro) decidía el lugar de cada persona.
Hoy el Consejo de Canarias vota la Ley del Genoma: algunos quieren que el nuevo metal sea el ADN. Los votos están empatados y el tuyo decidirá.
¿Puede una ley usar la ciencia para decidir el lugar de cada persona? ¿Quién decide qué genes valen más? # pregunta
-> END
