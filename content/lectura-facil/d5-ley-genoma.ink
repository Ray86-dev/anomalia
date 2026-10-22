// D5 en lectura fácil (D-10). Misma escena dinámica que dilemas/d5-ley-genoma.ink, en frases cortas.
// Ficción: el 2077 y la Ley del Genoma son inventados.
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
    Has vuelto a tu tiempo. Casi todo el mundo tiene un análisis de sus genes. Muchas empresas lo piden.
- desnivel >= 10:
    Has vuelto a tu tiempo. Cada vez más gente tiene un análisis de sus genes. Algunas empresas lo piden.
- else:
    Has vuelto a tu tiempo. Hay análisis de genes, pero casi solo se usan en los hospitales.
}
{
- equidad < 40:
    Cambiar los genes cuesta mucho dinero. Solo los ricos pueden pagarlo.
- confianza < 35:
    Mucha gente no se fía de los científicos.
- rama_d2_denuncia:
    Hay leyes que protegen a quien avisa de un peligro.
- rama_d1_firme:
    En las escuelas se recuerda que Galileo no cambió de idea.
}
// TODO(verificar): mito de los metales de Platón (La República).
Hace muchos siglos, Platón imaginó una ciudad. En ella, un metal decidía el lugar de cada persona: oro, plata, bronce o hierro.
Hoy se vota en Canarias la Ley de los Genes. Algunas personas quieren que los genes decidan el lugar de cada uno. Tu voto decide.
¿Está bien que una ley use los genes para decidir el lugar de cada persona? # pregunta
-> END
