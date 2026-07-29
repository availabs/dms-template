import {
  AM_PEAK_KEY,
  PM_PEAK_KEY,
  WEEKEND_KEY,
  MIDDAY_KEY,
  OVERNIGHT_KEY,
  NO_PEAK_KEY,
  SPEED_PERCENTILE_DOMAIN,
} from './updateFilters'
//format/map the time period/peak that is passed intop this

const TIME_PERIOD_DISPLAY = {
  [AM_PEAK_KEY]: 'weekday AM peak',
  [PM_PEAK_KEY]: 'weekday PM peak',
  [WEEKEND_KEY]: 'weekend',
  [MIDDAY_KEY]: 'weekday midday' //TODO verify this language
}

const TRAFFIC_TYPE_DISPLAY = {
  "all": '',
  "truck": "Excessive delay of all truck traffic."
}

const measure_info = {
  'lottr': {
    'definition': ({period}) => `The 80th percentile travel time over 50th percentile travel time for each segment of road during ${TIME_PERIOD_DISPLAY[period]} travel times.`,
    'equation': () => `80th/50th percentile travel times`
  },
  'tttr': {
    'definition':() => `Truck Travel Time Reliability measure (ratio).`,
    'equation': ({period}) => `95th/50th percentile travel times during weekday ${TIME_PERIOD_DISPLAY[period]} hours`
  },
  //todo this might just be `speed` internally
  'speed': {
    'definition':({percentile}) => `The ${ SPEED_PERCENTILE_DOMAIN.find(percDom => percDom.value === percentile)?.name } speed during all travel times.`,
    'equation': () => ``
  },
  'phed': {
    //TODO -- need to map `freeflow` to better language/formatting (freeflow vs posted speed limit)
    //vehicleHours -- between person hours, vehicle hours
    //TODO if all traffic is selected, dont show that value
    'definition': ({freeflow, trafficType}) => `${TRAFFIC_TYPE_DISPLAY[trafficType]}
     Excessive delay means the extra amount of time spent in congested conditions defined by speed thresholds
     that are lower than a normal delay threshold. 
     For the purposes of this rule, the speed threshold is 20 miles per hour or 60 percent of ${freeflow}, whichever is greater.`,
    'equation': () => ``
  },
  // 'ted': {
  //   //TODO -- need to map `freeflow` to better language/formatting (freeflow vs posted speed limit)
  //   //trafficType -- truck vs all
  //   //TODO if all traffic is selected, dont show that value
  //   'definition': ({freeflow, trafficType}) => `Excessive delay of ${trafficType}.
  //    Excessive delay means the extra amount of time spent in congested conditions defined by speed thresholds
  //    that are lower than a normal delay threshold. 
  //    For the purposes of this rule, the speed threshold is 20 miles per hour or 60 percent of ${freeflow}, whichever is greater.`,
  //   'equation': () => ``
  // }
}

export {
  measure_info
}