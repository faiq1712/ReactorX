import { Link } from "react-router-dom";

function LandingPage() {
  return (
    <div
      className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 text-white p-4"
      style={{ width: "50%", margin: "auto" }}
    >
      <div className="max-w-2xl text-center flex flex-col gap-6 mb-8">
        <h1
          className="text-4xl font-bold text-blue-400"
          style={{ color: "#3498db" }}
        >
          ReactorX
        </h1>

        <p className="text-lg text-blue-200">
          Welcome to ReactorX– Optimize Your Reactor Design with Confidence. Our
          Chemical Reaction Engineering Calculator helps you determine the
          number of adiabatic reactors needed to achieve a desired equilibrium
          conversion. So whether you are a Plant designer or just a CLL122
          student trying to solve the major question our calculator will be
          there for you.
        </p>
        <p className="text-lg text-blue-200">
          Simply input your feed conditions, reaction parameters, and target
          conversion — and let the calculator handle the rest.
        </p>
      </div>

      <Link
        to="/calculator"
        className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-teal-400 to-emerald-500 text-white font-semibold rounded-full transition-all duration-300 hover:from-teal-500 hover:to-emerald-600 hover:scale-105 hover:shadow-lg hover:shadow-teal-500/30 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-transparent mb-8"
      >
        Launch Calculator
      </Link>

      <div className="flex justify-center w-screen">
        <img
          src="/plant.svg"
          alt="Chemical plant illustration"
          className="max-w-full h-auto"
          style={{ maxWidth: "100vw" }}
        />
      </div>
    </div>
  );
}

export default LandingPage;
