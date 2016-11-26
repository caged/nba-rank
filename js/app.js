var el = d3.select(".js-vis"),
    ewidth = parseFloat(el.style("width")),
    eheight = parseFloat(el.style("height"))

var margin = { top: 20, right: 20, bottom: 20, left: 50 },
    width = ewidth - margin.left - margin.right,
    height = eheight - margin.top - margin.bottom

let color = d3.scaleSequential(d3.interpolateYlOrRd)
  .domain([40, 0])

function typeCastNumbersInRow(row) {
  var keys = Object.keys(row)
  keys.forEach(function(k) {
    var val = row[k]
    if(!isNaN(val)) row[k] = +val
  })

  return row
}

var q = d3.queue()
  .defer(d3.json, 'data/teams.json')
  .defer(d3.csv, 'data/combined.csv', typeCastNumbersInRow)
  .awaitAll((error, results) => {
    if(error) return console.log(error)

    let stats = results[1].filter(s => s.name.match(/\_rank/i))
    const teams = d3.nest().key(d => d.abbr).object(results[0])
    const headers = Object.keys(stats[0])

    // Some stats are duplicates across categories.  Filter them out
    const uniques = []
    stats = stats.filter((s) => {
      if (uniques.includes(s.name)) {
        return false
      } else {
        uniques.push(s.name)
        return true
      }
    })

    const table = el.append('table')
      .attr('id', 'stat-table')
      .attr('class', 'stats')

    table.append('thead')
      .append('tr')
    .selectAll('th')
      .data(headers)
    .enter().append('th')
      .attr('data-sort-method', (d, i) => { i < 1 ? 'string' : 'number' })
      .text(String)

    const tbody = table.append('tbody')
    const row = tbody.selectAll('.stat-row')
      .data(stats)
    .enter().append('tr')
      .attr('class', d => d.type.toLowerCase())

    row.selectAll('td')
      .data(d => d3.entries(d))
    .enter().append('td')
      .style('color', (d) => {
        if(!['name', 'type'].includes(d.key)) { return color(d.value) }
      })
      .text(d => { return isNaN(d.value) ? d.value.replace('_RANK', '') : d.value })

    new Tablesort(table.node())
  });
