// D5 en lectura fácil (D-10). Misma escena dinámica que dilemas/d5-ley-genoma.ink, en frases cortas.
// Ficción: el 2077 y la Ley del Genoma son inventados.

VAR equidad = 50
VAR confianza = 50
VAR desnivel = 0
VAR rama_d1_firme = false
VAR rama_d2_denuncia = false

=== escena ===
Canarias, 2077. # titulo
Has vuelto a tu tiempo. El 2077 es como lo han dejado tus decisiones.
{
- desnivel >= 25:
    Casi todo el mundo tiene un análisis de sus genes. Muchas empresas lo piden.
- desnivel >= 10:
    Cada vez más gente tiene un análisis de sus genes. Algunas empresas lo piden.
- else:
    Hay análisis de genes, pero casi solo se usan en los hospitales.
}
{ equidad < 40:
    Cambiar los genes cuesta mucho dinero. Solo los ricos pueden pagarlo.
}
{ confianza < 35:
    Mucha gente no se fía de los científicos.
}
{ rama_d1_firme:
    En las escuelas se recuerda que Galileo no cambió de idea.
}
{ rama_d2_denuncia:
    Hay leyes que protegen a quien avisa de un peligro.
}
// TODO(verificar): mito de los metales de Platón (La República).
Hace muchos siglos, Platón imaginó una ciudad. En ella, el lugar de cada persona dependía de un metal: oro, plata, bronce o hierro.
Hoy se vota en Canarias la Ley de los Genes. Algunas personas quieren que los genes decidan el lugar de cada uno.
Tu voto decide.
¿Está bien que una ley use los genes para decidir el lugar de cada persona? # pregunta
-> END
