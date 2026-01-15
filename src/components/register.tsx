import { useState } from "react";

function Register() {
  const [isLogin, setIsLogin] = useState(false);

  const [formData, setFormData] = useState({
    fname: "",
    lname: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const url = isLogin
      ? "http://localhost:1786/api/v1/login"
      : "http://localhost:1786/api/v1/register";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed");

      const data = await response.json();

      if (isLogin) {
        localStorage.setItem(
          "sp_user",
          JSON.stringify({
              fname: data.fname,
              email: data.email,
          })
        );

        // redirect to main page
        window.location.href = "/app";
      } else {
        alert("User Registered Successfully");
        setIsLogin(true); // switch to login after register
      }

    } catch (error) {
      alert("Operation Failed");
    }
  };

  return (
    <div className="flex items-center justify-center px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-md rounded-lg p-8"
      >
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">
          {isLogin ? "Login" : "Create an account"}
        </h2>

        <div className="space-y-4">
          {/* Register-only fields */}
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm text-gray-600">
                  First name
                </label>
                <input
                  name="fname"
                  onChange={handleChange}
                  placeholder="First Name"
                  className="mt-1 block w-full rounded-md border px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Last name</label>
                <input
                  name="lname"
                  onChange={handleChange}
                  placeholder="Last Name"
                  className="mt-1 block w-full rounded-md border px-4 py-2"
                />
              </div>
            </>
          )}

          {/* Common fields */}
          <div>
            <label className="block text-sm text-gray-600">Email</label>
            <input
              name="email"
              onChange={handleChange}
              placeholder="Email"
              className="mt-1 block w-full rounded-md border px-4 py-2"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600">Password</label>
            <input
              name="password"
              type="password"
              onChange={handleChange}
              placeholder="Password"
              className="mt-1 block w-full rounded-md border px-4 py-2"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition"
          >
            {isLogin ? "Login" : "Register"}
          </button>

          {/* Toggle Button */}
          <p className="text-center text-sm text-gray-600">
            {isLogin ? "New user?" : "Already a user?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-indigo-600 hover:underline"
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}

export default Register;
