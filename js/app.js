const el = d3.select(".js-vis")
const color = d3.scaleSequential(d3.interpolateYlOrRd)
  .domain([40, 0])

/**
 * Get some url paramaters
 * @param  {String} name name of search param to getUrlParameter
 * @return {String}      value of search param
 */
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]')
  var regex = new RegExp('[\\?&]' + name + '=([^&#]*)')
  var results = regex.exec(location.search)
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '))
}

/**
 * Convert things that look like numbers to numbers
 * via https://davidwalsh.name/query-string-javascript
 * @param  {Object} row object containing data to parse
 * @return {Object}     object with numbery things converted
 */
function typeCastNumbersInRow(row) {
  var keys = Object.keys(row)
  keys.forEach(function(k) {
    var val = row[k]
    if(!isNaN(val)) row[k] = +val
  })

  return row
}


/**
 * Create a distribution visualization for a particular statistic
 * @param  {Object} ranks object representing data for all 30 teams
 * @param  {Array} stats [description]
 * @param  {HTMLElment} el    [description]
 */
function visualizeStat(ranks, stats, el) {
  const statName = ranks.name.replace('_RANK', '')
  const statRow  = stats.find(s => s.name == statName)
  const statVals = d3.entries(statRow).filter(d => !isNaN(d.value))
  const rname    = ranks.name
  const name     = statRow.name
  const type     = statRow.type

  const margin = { top: 10, right: 10, bottom: 20, left: 10 }
  const width  = 500 - margin.left - margin.right
  const height = 40 - margin.top - margin.bottom

  const extent = d3.extent(statVals, d => d.value)
  const mean   = d3.mean(statVals, d => d.value)
  const x = d3.scaleLinear()
    .domain(extent)
    .range([0, width])
  const xax = d3.axisBottom()
    .scale(x)

  statVals.push({ key: 'AVG', value: mean })

  const svg = d3.select(el).append('td').append('svg')
    .attr('class', 'vis ' + name + ' ' + rname)
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

  svg.append('g')
    .attr('transform', 'translate(0,' + height + ')').call(xax)

  const group = svg.append('g')
    .attr('class', 'distribution')

  const tip = svg.append('text')
    .attr('class', 'tip')

  svg.on('mouseout', () => {
    tip.node().classList.remove('active')
  })

  group.selectAll('.team')
    .data(statVals)
  .enter().append('rect')
    .attr('class', d => 'team ' + d.key)
    .attr('width', 3)
    .attr('height', height)
    .attr('x', d => x(d.value))
    .on('mouseover', function(d) {
      const rect = d3.select(this)
      tip.text(d.key)
        .attr('x', rect.attr('x'))
        .node().classList.add('active')

    })
}

var q = d3.queue()
  .defer(d3.json, 'data/teams.json')
  .defer(d3.csv, 'data/combined.csv', typeCastNumbersInRow)
  .awaitAll((error, results) => {
    if(error) return console.log(error)

    const allStats  = results[1]
    let stats       = allStats.filter(s => s.name.match(/\_rank/i))
    const teams     = d3.nest().key(d => d.abbr).object(results[0])
    let headers   = Object.keys(stats[0])
    const showTeams = getUrlParameter('teams')
    const filteredTeams = showTeams.split(',')
    headers.push('distribution')

    const abbrs = results[0].map(t => t.abbr)
    const sel = d3.select('.js-sel')
    const btn = d3.select('.js-filter')

    sel.attr('value', showTeams)

    btn.on('mouseup', function() {
      const selected = sel.node().value
      const loc = document.location
      document.location = loc.origin + loc.pathname + "?teams=" + selected
    })

    if(showTeams !== "") {
      headers = ['name', 'type']
      const relevantKeys = headers.concat(filteredTeams)
      for (let row of stats) {
        const rkeys = Object.keys(row)
        for (let key of rkeys) {
          if(!relevantKeys.includes(key)) {
            delete row[key]
          }
        }
      }
      headers = Object.keys(stats[0])
      headers.push('distribution')
    }

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
      .html((d, i, all) => {
        if(d.key == 'type') return d.value
        if(isNaN(d.value)) {
          let cat = ""
          const prev = all[i + 1].__data__
          const val = d.value.replace('_RANK', '')

          if(prev.key == 'type') {
            // Defense category should link to 'Opponent'
            if(prev.value == 'Defense') {
              cat = 'opponent'
            } else {
              cat = prev.value.toLowerCase().replace(' ', '-')
            }
          }

          return '<a href="http://stats.nba.com/teams/' +
            cat + '#!?sort=' +
            val + '&dir=-1">' +
            val.replace(/_/g, ' ') + '</a>'
        }

        return d.value
      })

    row.each(function(d) {
      visualizeStat(d, allStats, this)
    })
    new Tablesort(table.node())
  });
