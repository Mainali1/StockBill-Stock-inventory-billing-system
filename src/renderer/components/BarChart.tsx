import React from "react";

export interface BarValue {
  value: number;
  tone: "ink" | "green";
}

export interface BarGroup {
  label: string;
  values: BarValue[];
}

export interface BarChartProps {
  groups: BarGroup[];
  height?: number;
  valueFormatter?: (value: number) => string;
}

export function BarChart({
  groups,
  height = 140,
  valueFormatter = (v) => v.toString(),
}: BarChartProps): React.JSX.Element {
  let max = 0;
  for (const g of groups) {
    for (const v of g.values) {
      if (v.value > max) max = v.value;
    }
  }

  return (
    <div
      className="bar-chart"
      style={{
        display: "flex",
        alignItems: "flex-end",
        height: `${height}px`,
        gap: "var(--space-3)",
        borderBottom: "var(--border-thin) solid var(--ink)",
        paddingBottom: "var(--space-1)",
        width: "100%",
      }}
    >
      {groups.map((group, gIdx) => {
        return (
          <div
            key={gIdx}
            className="bar-chart__group"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: "2px",
                width: "100%",
                flex: 1,
              }}
            >
              {group.values.map((v, vIdx) => {
                const formatted = valueFormatter(v.value);
                const titleText = `${group.label}: ${formatted}`;
                const pct = max > 0 ? (v.value / max) * 100 : 0;
                const isZero = v.value === 0;

                const bg = v.tone === "green" ? "var(--green)" : "var(--ink)";

                return (
                  <div
                    key={vIdx}
                    className="bar-chart__bar"
                    title={titleText}
                    aria-label={titleText}
                    style={{
                      position: "relative",
                      width: group.values.length > 1 ? "45%" : "80%",
                      maxWidth: "24px",
                      height: isZero ? "2px" : `${Math.max(2, pct)}%`,
                      background: bg,
                      minHeight: "2px",
                    }}
                  >
                    {v.tone === "ink" && !isZero && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          width: 0,
                          height: 0,
                          borderStyle: "solid",
                          borderWidth: "4px 0 0 4px",
                          borderColor: "transparent transparent transparent var(--paper-hi)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
                color: "var(--ink-soft)",
                marginTop: "var(--space-1)",
              }}
            >
              {group.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
