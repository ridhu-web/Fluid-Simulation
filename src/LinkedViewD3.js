import React, { useEffect, useRef, useState } from "react";
import useSVGCanvas from "./useSVGCanvas.js";
import * as d3 from "d3";

//TODO: modify this to make a new glyph that captures both the in-plane velocity and concentration
//example function/code for making a custom glyph
//d is the data point {position, velocity,concentration}, axis is ['x','y','z'], scale is optional value to pass to help scale the object size
function makeVelocityGlyph(d, axis, sizeFactor, scale = 1, concentration) {
  var xv = d.velocity[1];
  var yv = d.velocity[2];
  if (axis === "y") {
    xv = d.velocity[0];
    yv = d.velocity[1];
  } else if (axis === "z") {
    xv = d.velocity[0];
  }

  let xpos = xv / scale;
  let ypos = yv / scale;

  // Compute the circle's radius based on concentration
  const circleRadius = concentration * 0.1; // Modify multiplier as needed

  // Compute the circle's position based on the end of the glyph
  const circleX = xpos + circleRadius * Math.cos(Math.atan2(ypos, xpos));
  const circleY = ypos + circleRadius * Math.sin(Math.atan2(ypos, xpos));

  let path =
    "M " +
    xpos +
    "," +
    ypos +
    " " +
    -ypos / 3 +
    "," +
    xpos / 3 +
    " " +
    ypos / 3 +
    "," +
    -xpos / 3 +
    "z " +
    "M " +
    circleX +
    "," +
    circleY +
    " " +
    "m -" +
    circleRadius +
    ", 0" +
    " " +
    "a " +
    circleRadius +
    "," +
    circleRadius +
    " 0 1,0 " +
    2 * circleRadius +
    ",0" +
    " " +
    "a " +
    circleRadius +
    "," +
    circleRadius +
    " 0 1,0 " +
    -2 * circleRadius +
    ",0";

  return path;
}

export default function LinkedViewD3(props) {
  //this is a generic component for plotting a d3 plot
  const d3Container = useRef(null);
  const [svg, height, width, tTip] = useSVGCanvas(d3Container);

  const margin = 10;
  //sets a number of the number of particles we show when the brushed area has is too large
  const maxDots = 2000;

  const [tooltip, setTooltip] = useState({ visibility: "hidden", data: null });

  useEffect(() => {
    if (
      svg !== undefined &&
      props.data !== undefined &&
      props.bounds !== undefined
    ) {
      //filter data by particles in the brushed region
      const bDist = (d) => props.brushedCoord - props.getBrushedCoord(d);
      function isBrushed(d) {
        return Math.abs(bDist(d)) < props.brushedAreaThickness;
      }
      var data = props.data.filter(isBrushed);

      const bounds = props.bounds;
      var xExtents = [bounds.minZ, bounds.maxZ];
      var yExtents = [bounds.minY, bounds.maxY];

      var getX = (d) => d.position[1];
      var getY = (d) => d.position[2];
      if (props.brushedAxis === "y") {
        xExtents = [bounds.minX, bounds.maxX];
        yExtents = [bounds.minZ, bounds.maxZ];
        getX = (d) => d.position[0];
        getY = (d) => d.position[1];
      } else if (props.brushedAxis === "z") {
        getX = (d) => d.position[0];
      }

      //TODO: filter out points with a concentration of less than 80% of the maximum value of the current filtered datapoints
      data.sort((a, b) => bDist(a) - bDist(b));
      if (data.length > maxDots) {
        data = data.slice(0, maxDots);
      }

      console.log(props.threshold);

      const concentrationThreshold =
        (props.threshold / 100) * d3.max(data, (d) => d.concentration);
      data = data.filter((d) => d.concentration >= concentrationThreshold);

      console.log("Concentration Threshold: ", concentrationThreshold);
      console.log("Filtered data length: ", data.length);

      const sizeScale = d3
        .scaleLinear()
        .domain([
          d3.min(data, (d) => d.concentration),
          d3.max(data, (d) => d.concentration),
        ])
        .range([0.5, 1.0]);

      const getVelocityMagnitude = (d) =>
        Math.sqrt(d.velocity[0] ** 2 + d.velocity[1] ** 2 + d.velocity[2] ** 2);
      const vMax = d3.max(data, getVelocityMagnitude);

      const data32 = data.filter(
        (d) => d.concentration >= 0.32 * d3.max(data, (d) => d.concentration)
      );
      const length32 = data32.length;

      const calculatedRadius = Math.max(
        (3 * Math.min(width, height)) / Math.min(data.length, length32),
        5
      );

      let xScale = d3
        .scaleLinear()
        .domain(xExtents)
        .range([margin + calculatedRadius, width - margin - calculatedRadius]);
      let yScale = d3
        .scaleLinear()
        .domain(yExtents)
        .range([height - margin - calculatedRadius, margin + calculatedRadius]);

      let colorScale = d3
        .scaleLinear()
        .domain([
          d3.min(data, (d) => d.concentration),
          d3.max(data, (d) => d.concentration),
        ])
        .range(props.colorRange);

      let dots = svg.selectAll(".glyph").data(data, (d) => d.id);
      dots
        .enter()
        .append("path")
        .attr("class", "glyph")
        .merge(dots)
        .transition(10)
        .attr("d", (d) =>
          makeVelocityGlyph(
            d,
            props.brushedAxis,
            sizeScale(d.concentration),

            (0.25 * vMax * 10) / calculatedRadius,
            d.concentration
          )
        )
        .attr("fill", (d) => colorScale(d.concentration))
        .attr("stroke", "black")
        .attr("stroke-width", 0.1)
        .attr("transform", (d) => {
          return "translate(" + xScale(getX(d)) + "," + yScale(getY(d)) + ")";
        });

      dots.exit().remove();
    }
  }, [svg, props.data, props.getBrushedCoord, props.bounds, props.threshold]);

  return (
    <div
      className={"d3-component"}
      style={{ height: "99%", width: "99%" }}
      ref={d3Container}
    ></div>
  );
}
