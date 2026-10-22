// D5 · Canarias, 2077 — La Ley del Genoma. Narra Mnemósine.
// Escena dinámica (§5): cambia según el estado del mundo y las ramas abiertas.
// El juego pasa poder, responsabilidad, equidad, confianza, desnivel y rama_<id>
// (por ejemplo, rama_d1_firme) antes de narrar; si no, valen lo que se declara aquí.
// Ficción: el 2077, el Consejo de Canarias y la Ley del Genoma son inventados.
// Lo marcado con TODO(verificar) no está en el documento de diseño: debe revisarlo el docente.

VAR equidad = 50
VAR confianza = 50
VAR desnivel = 0
VAR rama_d1_firme = false
VAR rama_d2_denuncia = false

=== escena ===
Canarias, 2077. # titulo
Has vuelto a tu tiempo. Este 2077 es el que han dejado tus decisiones.
{
- desnivel >= 25:
    Aquí casi todo el mundo tiene su perfil genético. Muchas empresas y centros de estudio ya piden verlo.
- desnivel >= 10:
    Los perfiles genéticos son cada vez más comunes. Algunas empresas ya preguntan por ellos.
- else:
    Los perfiles genéticos existen, pero casi nadie los usa fuera de los hospitales.
}
{ equidad < 40:
    Las clínicas de mejora genética son caras. Solo quien puede pagarlas las usa.
}
{ confianza < 35:
    Mucha gente ya no se fía de lo que dicen los científicos.
}
{ rama_d1_firme:
    En las escuelas todavía se cuenta cómo Galileo no se dejó doblar.
}
{ rama_d2_denuncia:
    Desde que un químico se atrevió a hablar en 1915, hay leyes que protegen a quien denuncia un peligro.
}
// TODO(verificar): mito de los metales de Platón (La República), trabajado en clase con Gattaca.
Hace más de 2.400 años, Platón imaginó una ciudad en la que cada persona llevaba un metal en el alma: oro, plata, bronce o hierro. Ese metal decidía su lugar.
Hoy, el Consejo de Canarias vota la Ley del Genoma. Algunos quieren que el nuevo metal sea el ADN.
Los votos están empatados. El tuyo decidirá.
¿Puede una ley usar la ciencia para decidir el lugar de cada persona? ¿Quién decide qué genes valen más? # pregunta
-> END
