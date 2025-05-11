import { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const R_VALUE = 1.987;
const ITER_MAX = 50;
const TOLERANCE = 0.0001;
const STAGE_LIMIT = 5;
const STEP_SIZE = 10;

function computeK(t, baseK, deltaH) {
  const expTerm = (deltaH / R_VALUE) * (1 / 298 - 1 / t);
  return baseK * Math.exp(expTerm);
}

function computeThermodynamicConversion(t, baseK, deltaH) {
  const k = computeK(t, baseK, deltaH);
  return k / (1 + k);
}

function computeEnergyBalanceConversion(t, initialTemp, heatCapacity, deltaH) {
  return (heatCapacity * (t - initialTemp)) / Math.abs(deltaH);
}

function useNewtonSolver() {
  function solveForIntersection(
    initTemp,
    cumulativeConversion,
    startingTemp,
    reactorParams
  ) {
    const { baseK, deltaH, heatCapacity } = reactorParams;

    function objectiveFunction(t) {
      return (
        computeThermodynamicConversion(t, baseK, deltaH) -
        (cumulativeConversion +
          computeEnergyBalanceConversion(t, startingTemp, heatCapacity, deltaH))
      );
    }

    function calculateDerivative(t) {
      const delta = 0.01;
      return (objectiveFunction(t + delta) - objectiveFunction(t)) / delta;
    }

    let t = initTemp + 100;
    let count = 0;

    while (count < ITER_MAX) {
      const fValue = objectiveFunction(t);

      if (Math.abs(fValue) < TOLERANCE) {
        break;
      }

      const derivative = calculateDerivative(t);

      if (Math.abs(derivative) < 1e-10) {
        t += fValue > 0 ? -10 : 10;
      } else {
        const nextT = t - fValue / derivative;

        if (Math.abs(nextT - t) > 100) {
          t = t - (0.5 * fValue) / derivative;
        } else {
          t = nextT;
        }
      }

      if (t < startingTemp) {
        t = startingTemp + 1;
      }

      count++;
    }

    const finalX = computeThermodynamicConversion(t, baseK, deltaH);

    return {
      eqTemp: t,
      conversion: finalX,
      iterations: count,
    };
  }

  return { solveForIntersection };
}

function getColorSet(stageNum) {
  const palette = [
    { primary: "rgb(0, 99, 132)", light: "rgba(0, 99, 132, 0.5)" },
    { primary: "rgb(75, 192, 100)", light: "rgba(75, 192, 100, 0.5)" },
    { primary: "rgb(255, 159, 64)", light: "rgba(255, 159, 64, 0.5)" },
    { primary: "rgb(153, 102, 255)", light: "rgba(153, 102, 255, 0.5)" },
  ];

  const index = stageNum % palette.length;
  return palette[index];
}

function EquilibriumCalculator() {
  const defaultInputs = {
    Ha: -40000,
    Hb: -60000,
    Ca: 50,
    Cb: 50,
    Fa0: 40,
    Ke: 100000,
    temperature: 300,
    T0: 300,
    coolingTemp: 350,
    targetConversion: 0.8,
  };

  const [inputs, setInputs] = useState(defaultInputs);
  const [results, setResults] = useState(null);
  const [reactorStages, setReactorStages] = useState([]);
  const [error, setError] = useState(null);

  const { solveForIntersection } = useNewtonSolver();

  const derivedParams = useMemo(
    () => ({
      deltaH: inputs.Hb - inputs.Ha,
      heatCapacity: inputs.Ca,
      baseK: inputs.Ke,
    }),
    [inputs.Ha, inputs.Hb, inputs.Ca, inputs.Ke]
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text: "Equilibrium Conversion vs Temperature",
      },
      tooltip: {
        callbacks: {
          label: function (ctx) {
            return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Temperature (K)",
        },
      },
      y: {
        title: {
          display: true,
          text: "Conversion",
        },
        min: 0,
        max: 1,
      },
    },
  };

  function handleInputChange(e) {
    const { name, value } = e.target;
    setInputs((current) => {
      const updatedInputs = { ...current, [name]: parseFloat(value) };

      if (name === "Ca") {
        if (updatedInputs.Ca !== updatedInputs.Cb) {
          setError(
            "Error: Cpa and Cpb must be equal for this calculation model."
          );
        } else {
          setError(null);
        }
      } else if (name === "Cb") {
        if (updatedInputs.Cb !== updatedInputs.Ca) {
          setError(
            "Error: Cpa and Cpb must be equal for this calculation model."
          );
        } else {
          setError(null);
        }
      }

      return updatedInputs;
    });
  }

  const chartData = useMemo(() => {
    if (!derivedParams) return null;

    const { T0 } = inputs;
    const { deltaH, heatCapacity, baseK } = derivedParams;

    const temps = [];
    const thermodynamicConversions = [];
    const energyBalanceConversions = [];

    for (let t = T0; t <= T0 + 500; t += STEP_SIZE) {
      temps.push(t);
      thermodynamicConversions.push(
        computeThermodynamicConversion(t, baseK, deltaH)
      );
      energyBalanceConversions.push(
        computeEnergyBalanceConversion(t, T0, heatCapacity, deltaH)
      );
    }

    const dataSets = [
      {
        label: "Xe (Thermodynamic)",
        data: thermodynamicConversions,
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
      {
        label: "Xeb (Energy Balance)",
        data: energyBalanceConversions,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ];

    if (reactorStages.length > 0) {
      const { coolingTemp } = inputs;

      reactorStages.forEach((stage, idx) => {
        if (stage.eqTemp && stage.conversion) {
          const prevX = idx === 0 ? 0 : reactorStages[idx - 1].conversion;

          const stageEnergyBalance = temps.map((t) =>
            t >= coolingTemp
              ? prevX +
                computeEnergyBalanceConversion(
                  t,
                  coolingTemp,
                  heatCapacity,
                  deltaH
                )
              : null
          );

          if (idx !== 0) {
            const colorSet = getColorSet(idx);
            dataSets.push({
              label: `Stage ${idx + 1} Energy Balance`,
              data: stageEnergyBalance,
              borderColor: colorSet.primary,
              backgroundColor: colorSet.light,
              borderDash: [5, 5],
            });
          }
        }
      });
    }

    return {
      labels: temps,
      datasets: dataSets,
    };
  }, [inputs, reactorStages, derivedParams]);

  function runCalculation() {
    if (inputs.Ca !== inputs.Cb) {
      setError("Error: Cpa and Cpb must be equal for this calculation model.");
      return;
    }

    setError(null);

    const { temperature, T0, coolingTemp, targetConversion } = inputs;
    const { deltaH, heatCapacity, baseK } = derivedParams;

    const k = computeK(temperature, baseK, deltaH);
    const thermodynamicX = computeThermodynamicConversion(
      temperature,
      baseK,
      deltaH
    );
    const energyBalanceX = computeEnergyBalanceConversion(
      temperature,
      T0,
      heatCapacity,
      deltaH
    );

    const firstReactor = solveForIntersection(T0, 0, T0, {
      baseK,
      deltaH,
      heatCapacity,
    });

    const reactors = [firstReactor];
    let totalConversion = firstReactor.conversion;
    let reactorCount = 1;

    while (totalConversion < targetConversion && reactorCount < STAGE_LIMIT) {
      const nextReactor = solveForIntersection(
        coolingTemp,
        totalConversion,
        coolingTemp,
        { baseK, deltaH, heatCapacity }
      );

      reactors.push(nextReactor);
      totalConversion = nextReactor.conversion;
      reactorCount++;

      if (totalConversion > 0.99) break;
    }

    setReactorStages(reactors);

    setResults({
      Xe: thermodynamicX,
      Xeb: energyBalanceX,
      keAtTemp: k,
      intersection:
        Math.abs(thermodynamicX - energyBalanceX) < 0.01
          ? "Yes (within 1%)"
          : "No",
      adiabaticEqTemp: firstReactor.eqTemp,
      eqConversion: firstReactor.conversion,
      iterations: firstReactor.iterations,
      stages: reactors,
      finalConversion: totalConversion,
      targetReached: totalConversion >= targetConversion,
    });
  }

  return (
    <div className="calculator-container">
      <h2>First Order Reversible Reaction (Exothermic)</h2>
      <img src="/rxn-image.png" alt="A to B reversible reaction" width={100} />

      {error && <div className="error-message">{error}</div>}

      <div className="input-section">
        <div className="input-column">
          <h3>Thermodynamic Parameters</h3>
          <div className="input-group">
            <label>
              H°A (cal/mol):
              <input
                type="number"
                name="Ha"
                value={inputs.Ha}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
          <div className="input-group">
            <label>
              H°B (cal/mol):
              <input
                type="number"
                name="Hb"
                value={inputs.Hb}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
          <div className="input-group">
            <label>
              CP,A (cal/mol·K):
              <input
                type="number"
                name="Ca"
                value={inputs.Ca}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
          <div className="input-group">
            <label>
              CP,B (cal/mol·K):
              <input
                type="number"
                name="Cb"
                value={inputs.Cb}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
          <div className="input-group">
            <label>
              Fa0 (mol/s):
              <input
                type="number"
                name="Fa0"
                value={inputs.Fa0}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
          <div className="input-group">
            <label>
              Ke at 298K:
              <input
                type="number"
                name="Ke"
                value={inputs.Ke}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
        </div>

        <div className="input-column">
          <h3>Process Parameters</h3>
          <div className="input-group">
            <label>
              Initial Temperature T0 (K):
              <input
                type="number"
                name="T0"
                value={inputs.T0}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
          <div className="input-group">
            <label>
              Cooling Temperature (K):
              <input
                type="number"
                name="coolingTemp"
                value={inputs.coolingTemp}
                onChange={handleInputChange}
                step="1"
              />
            </label>
          </div>
          <div className="input-group">
            <label>
              Target Conversion (0-1):
              <input
                type="number"
                name="targetConversion"
                value={inputs.targetConversion}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                max="1"
              />
            </label>
          </div>
        </div>
      </div>

      <button
        onClick={runCalculation}
        className="calculate-button"
        disabled={error !== null}
      >
        Calculate Multi-Stage Equilibrium
      </button>

      {results && (
        <div className="reactor-count">
          <h3>Reactor Configuration:</h3>
          <div className="count-box">
            <p>
              <strong>Number of Reactors Required:</strong>{" "}
              {results.stages.length}
            </p>
          </div>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Results:</h3>

          <div className="results-grid">
            <div className="first-stage">
              <h4>First Reactor:</h4>
              <p>
                <strong>Adiabatic Equilibrium Temperature:</strong>{" "}
                {results.adiabaticEqTemp.toFixed(2)} K
              </p>
              <p>
                <strong>Equilibrium Conversion:</strong>{" "}
                {results.eqConversion.toFixed(4)}
              </p>
              <p>
                <strong> Heat removed(kcal): </strong>
                {(
                  (-inputs.Fa0 *
                    inputs.Ca *
                    (results.adiabaticEqTemp.toFixed(2) - inputs.coolingTemp)) /
                  1000
                ).toFixed(2)}
              </p>
            </div>

            {results.stages && results.stages.length > 1 && (
              <div className="additional-stages">
                <h4>Additional Reactor Stages:</h4>
                {results.stages.slice(1).map((stage, idx) => {
                  const prevX =
                    idx === 0
                      ? results.eqConversion
                      : results.stages[idx].conversion;

                  return (
                    <div key={idx} className="stage">
                      <h5>Stage {idx + 2}:</h5>
                      <p>
                        Equilibrium Temperature: {stage.eqTemp.toFixed(2)} K
                      </p>
                      <p>
                        Additional Conversion:{" "}
                        {(stage.conversion - prevX).toFixed(4)}
                      </p>
                      <p>
                        Cumulative Conversion: {stage.conversion.toFixed(4)}
                      </p>
                      <p>
                        <strong>Heat removed (kcal): </strong>
                        {(
                          (-inputs.Fa0 *
                            inputs.Ca *
                            (stage.eqTemp - inputs.coolingTemp)) /
                          1000
                        ).toFixed(2)}
                      </p>
                    </div>
                  );
                })}

                <div className="final-conversion">
                  <h4>Final Results:</h4>
                  <p>
                    <strong>
                      Overall Conversion after {results.stages.length} stages:
                    </strong>{" "}
                    {results.finalConversion.toFixed(4)}
                  </p>
                  <p>
                    <strong>
                      Target Conversion ({inputs.targetConversion.toFixed(2)}):
                    </strong>{" "}
                    {results.targetReached ? (
                      <span
                        style={{
                          color: "rgb(39, 174, 96)",
                          fontWeight: "bold",
                        }}
                      >
                        ✓ Achieved
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "rgb(192, 57, 43)",
                          fontWeight: "bold",
                        }}
                      >
                        ✗ Not Reached
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {chartData && (
        <div className="chart-container">
          <Line options={chartOptions} data={chartData} />

          {results && (
            <div className="chart-description">
              <p>
                The chart shows the thermodynamic equilibrium curve (blue) and
                energy balance lines for each reactor stage.
              </p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .calculator-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        h2 {
          text-align: center;
          margin-bottom: 25px;
          color: #3498db;
        }

        .error-message {
          background-color: rgb(231, 76, 60, 0.1);
          color: rgb(192, 57, 43);
          padding: 12px 15px;
          margin: 15px 0;
          border-radius: 4px;
          border-left: 4px solid rgb(192, 57, 43);
          font-weight: 500;
        }

        .input-section {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 20px;
        }

        .input-column {
          flex: 1;
          min-width: 300px;
        }

        .input-column h3 {
          margin-bottom: 15px;
          color: rgb(52, 152, 219);
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
        }

        .input-group {
          margin-bottom: 12px;
        }

        .input-group label {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .input-group input {
          width: 120px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .calculate-button {
          display: block;
          width: 100%;
          padding: 12px;
          background-color: rgb(52, 152, 219);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
          margin: 20px 0;
        }

        .calculate-button:hover {
          background-color: rgb(41, 128, 185);
        }

        .calculate-button:disabled {
          background-color: rgb(189, 195, 199);
          cursor: not-allowed;
        }

        .reactor-count {
          margin-top: 30px;
          padding: 20px;
          background-color: rgb(230, 230, 250);
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          color: rgb(44, 62, 80);
        }

        .reactor-count h3 {
          margin-top: 0;
          color: rgb(44, 62, 80);
          border-bottom: 1px solid rgb(189, 195, 199);
          padding-bottom: 10px;
          font-weight: bold;
        }

        .count-box {
          background-color: white;
          padding: 15px;
          border-radius: 6px;
          text-align: center;
          font-size: 18px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .results {
          margin-top: 30px;
          padding: 20px;
          background-color: rgb(237, 242, 247);
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          color: rgb(44, 62, 80);
        }

        .results h3 {
          margin-top: 0;
          color: rgb(44, 62, 80);
          border-bottom: 1px solid rgb(189, 195, 199);
          padding-bottom: 10px;
          font-weight: bold;
        }

        .results-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }

        .first-stage,
        .additional-stages {
          flex: 1;
          min-width: 300px;
          background-color: #fff;
          padding: 15px;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          color: #333;
        }

        .first-stage h4,
        .additional-stages h4 {
          color: rgb(44, 62, 80);
          margin-top: 0;
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
        }

        .stage {
          margin-bottom: 15px;
          padding: 10px;
          background-color: rgb(240, 247, 252);
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          color: #333;
        }

        .stage h5 {
          margin-top: 0;
          color: rgb(44, 62, 80);
          font-weight: 600;
        }

        .final-conversion {
          margin-top: 20px;
          padding: 10px;
          background-color: rgb(212, 230, 241);
          border-radius: 4px;
          color: rgb(44, 62, 80);
        }

        .chart-container {
          margin-top: 30px;
          height: 400px;
          padding: 10px;
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .chart-description {
          margin-top: 15px;
          text-align: center;
          color: rgb(127, 140, 141);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

export default EquilibriumCalculator;
