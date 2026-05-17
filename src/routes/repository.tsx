import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/repository")({
  component: RepositoryPage,
});

function RepositoryPage() {

  const [objects, setObjects] = useState<any[]>([]);

  const [selected, setSelected] = useState<any>(null);

  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {

    fetch(
      "http://127.0.0.1:8001/knowledge-objects"
    )

      .then(res => res.json())

      .then(data => {

        setObjects(data);

      });

  }, []);

  const filtered = objects.filter((o) => {

    const matchesSearch =
      o.name.toLowerCase().includes(
        search.toLowerCase()
      );

    const matchesType =
      typeFilter === "all"
      ||
      o.id.includes(typeFilter);

    return (
      matchesSearch
      &&
      matchesType
    );

  });

  function downloadObject(obj: any) {

    const blob = new Blob(

      [
        JSON.stringify(
          obj,
          null,
          2
        )
      ],

      {
        type: "application/json"
      }

    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `${obj.name}.json`;

    a.click();

    URL.revokeObjectURL(url);

  }

  return (

    <div className="h-screen grid grid-cols-[430px_1fr]">

      {/* ================================= */}
      {/* SIDEBAR */}
      {/* ================================= */}

      <div className="border-r border-border p-4 overflow-auto">

        <div className="flex items-center gap-2 mb-5">

          <div className="text-2xl">

            📚

          </div>

          <div className="text-2xl font-semibold">

            Repository

          </div>

        </div>

        {/* SEARCH */}

        <input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search..."
          className="

            w-full
            rounded-lg
            border
            border-border
            bg-card
            px-3
            py-2
            mb-4

          "
        />

        {/* FILTER */}

        <select

          value={typeFilter}

          onChange={(e) =>
            setTypeFilter(
              e.target.value
            )
          }

          className="

            w-full
            rounded-lg
            border
            border-border
            bg-card
            px-3
            py-2
            mb-5

          "
        >

          <option value="all">

            All types

          </option>

          <option value="dashboard">

            dashboard

          </option>

          <option value="alert">

            alert

          </option>

          <option value="lookup">

            lookup

          </option>

        </select>

        {/* OBJECTS */}

        <div className="space-y-3">

          {filtered.map((obj, idx) => (

            <div

              key={idx}

              onClick={() =>
                setSelected(obj)
              }

              className="

                rounded-xl
                border
                border-border
                bg-card
                p-4
                cursor-pointer
                hover:border-cyan-400
                transition-all

              "

            >

              <div className="font-semibold mb-1">

                {obj.name}

              </div>

              <div className="text-xs text-muted-foreground">

                {obj.id}

              </div>

            </div>

          ))}

        </div>

      </div>

      {/* ================================= */}
      {/* MAIN */}
      {/* ================================= */}

      <div className="p-6 overflow-auto">

        {!selected && (

          <div className="h-full flex items-center justify-center text-muted-foreground">

            Select a knowledge object

          </div>

        )}

        {selected && (

          <div>

            {/* HEADER */}

            <div className="flex items-center justify-between mb-6">

              <div>

                <div className="text-3xl font-semibold mb-2">

                  {selected.name}

                </div>

                <div className="text-sm text-muted-foreground">

                  Knowledge Object

                </div>

              </div>

              <button

                onClick={() =>
                  downloadObject(selected)
                }

                className="

                  px-5
                  py-2
                  rounded-lg
                  border
                  border-cyan-500
                  text-cyan-400
                  hover:bg-cyan-500/10

                "

              >

                Download

              </button>

            </div>

            {/* DETAILS */}

            <div className="rounded-xl border border-border bg-card p-5 mb-6">

              <div className="text-lg font-semibold mb-4">

                Object Details

              </div>

              <div className="space-y-2 text-sm">

                <div>

                  <span className="text-muted-foreground">

                    ID:

                  </span>

                  {" "}
                  {selected.id}

                </div>

                <div>

                  <span className="text-muted-foreground">

                    Created:

                  </span>

                  {" "}
                  {selected.created_at}

                </div>

              </div>

            </div>

            {/* SPL */}

            {selected.spl && (

              <div className="rounded-xl border border-border bg-card p-5 mb-6">

                <div className="text-lg font-semibold mb-4">

                  SPL Query

                </div>

                <pre className="text-cyan-400 whitespace-pre-wrap text-sm">

                  {selected.spl}

                </pre>

              </div>

            )}

            {/* RAW JSON */}

            <div className="rounded-xl border border-border bg-card p-5">

              <div className="text-lg font-semibold mb-4">

                Raw JSON

              </div>

              <pre className="text-sm whitespace-pre-wrap">

                {

                  JSON.stringify(
                    selected,
                    null,
                    2
                  )

                }

              </pre>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}