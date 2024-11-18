import { MongoClient } from "mongodb";
import { faker } from "@faker-js/faker";

const client = new MongoClient("mongodb://localhost:27017");

async function generarDatos() {
  try {
    await client.connect();
    const db = client.db("torneo_futbol");

    // 1. Generar Equipos
    const equipos = Array.from({ length: 10 }, (_, i) => ({
      nombre: `Equipo ${i + 1}`,
      entrenador: {
        nombre: faker.person.fullName(),
        experiencia: faker.number.int({ min: 1, max: 10 }),
        nacionalidad: faker.location.country(),
      },
    }));
    await db.collection("equipos").insertMany(equipos);

    // 2. Generar Jugadores
    const posiciones = ["Portero", "Defensa", "Mediocampista", "Delantero"];
    const jugadores = equipos.flatMap((equipo) =>
      Array.from({ length: 25 }, () => {
        const goles = faker.number.int({ min: 0, max: 15 });
        const asistencias = faker.number.int({ min: 0, max: 10 });
        const minutosJugados = faker.number.int({ min: 300, max: 1200 });
        return {
          nombre: faker.person.fullName(),
          edad: faker.number.int({ min: 18, max: 35 }),
          posicion: faker.helpers.arrayElement(posiciones),
          equipo: equipo.nombre,
          estadisticas: {
            goles,
            asistencias,
            minutosJugados,
          },
        };
      })
    );
    await db.collection("jugadores").insertMany(jugadores);

    // 3. Generar Árbitros
    const arbitros = Array.from({ length: 5 }, () => ({
      nombre: faker.person.fullName(),
      nacionalidad: faker.location.country(),
      experiencia: faker.number.int({ min: 1, max: 15 }),
      partidosDirigidos: [],
    }));
    await db.collection("arbitros").insertMany(arbitros);

    // 4. Generar Encuentros
    const encuentros = [];
    for (let ronda = 1; ronda <= 5; ronda++) {
      for (let i = 0; i < 5; i++) {
        const arbitroSeleccionado = faker.helpers.arrayElement(arbitros);
        const golesLocal = faker.number.int({ min: 0, max: 5 });
        const golesVisitante = faker.number.int({ min: 0, max: 5 });
        const encuentro = {
          ronda,
          fecha: faker.date.past({ years: 1 }).toISOString(),
          equipos: {
            local: equipos[i].nombre,
            visitante: equipos[equipos.length - 1 - i].nombre,
          },
          arbitro: arbitroSeleccionado.nombre,
          resultado: {
            golesLocal,
            golesVisitante,
          },
          eventos: Array.from(
            { length: golesLocal + golesVisitante }, // Generamos eventos por la cantidad de goles
            () => ({
              minuto: faker.number.int({ min: 1, max: 90 }),
              evento: faker.helpers.arrayElement([
                "Gol",
                "Tarjeta Amarilla",
                "Tarjeta Roja",
              ]),
              jugador: faker.helpers.arrayElement(jugadores).nombre,
            })
          ),
        };

        // Añadir el partido dirigido al árbitro
        await db
          .collection("arbitros")
          .updateOne(
            { nombre: arbitroSeleccionado.nombre },
            { $push: { partidosDirigidos: encuentro } }
          );

        // Agregar encuentro a la lista
        encuentros.push(encuentro);
      }
    }
    await db.collection("encuentros").insertMany(encuentros);

    // 5. Generar Tabla de Posiciones con los puntos reales
    const tablaPosiciones = equipos.map((equipo) => ({
      equipo: equipo.nombre,
      puntos: 0,
      partidosJugados: 0,
      victorias: 0,
      empates: 0,
      derrotas: 0,
      golesAFavor: 0,
      golesEnContra: 0,
      diferenciaDeGoles: 0,
    }));

    // Actualizar puntos, victorias, empates y derrotas basados en los resultados de los encuentros
    for (const encuentro of encuentros) {
      const local = tablaPosiciones.find(
        (e) => e.equipo === encuentro.equipos.local
      );
      const visitante = tablaPosiciones.find(
        (e) => e.equipo === encuentro.equipos.visitante
      );

      // Incrementar partidos jugados
      local.partidosJugados++;
      visitante.partidosJugados++;

      // Sumar goles a favor y en contra
      local.golesAFavor += encuentro.resultado.golesLocal;
      visitante.golesAFavor += encuentro.resultado.golesVisitante;
      local.golesEnContra += encuentro.resultado.golesVisitante;
      visitante.golesEnContra += encuentro.resultado.golesLocal;

      // Calcular diferencia de goles
      local.diferenciaDeGoles = local.golesAFavor - local.golesEnContra;
      visitante.diferenciaDeGoles =
        visitante.golesAFavor - visitante.golesEnContra;

      // Asignar puntos según resultado
      if (encuentro.resultado.golesLocal > encuentro.resultado.golesVisitante) {
        // Victoria para el local
        local.victorias++;
        visitante.derrotas++;
        local.puntos += 3; // Local gana 3 puntos
      } else if (
        encuentro.resultado.golesLocal < encuentro.resultado.golesVisitante
      ) {
        // Victoria para el visitante
        visitante.victorias++;
        local.derrotas++;
        visitante.puntos += 3; // Visitante gana 3 puntos
      } else {
        // Empate
        local.empates++;
        visitante.empates++;
        local.puntos += 1; // Ambos equipos reciben 1 punto
        visitante.puntos += 1;
      }
    }

    // Insertar la tabla de posiciones con los puntos actualizados
    await db.collection("tabla_posiciones").insertMany(tablaPosiciones);

    console.log("Datos ficticios generados con éxito.");
  } finally {
    await client.close();
  }
}

generarDatos().catch(console.error);
