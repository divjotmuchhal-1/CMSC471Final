# CMSC471 Final - Tempest Trends

**Creators:** Amindu Abeydeera, Divjot Muchhal, Nikhil Paruchuri

**Description:** Our visualization is a climate variability dashboard. As our generation is overall responsible for what happens to our climate, the understanding of the past, present, and future aspects of our climate is important. Our visualization conveys the understanding of climate variability, specifically in the United States throughout the years, and how it may look in the future, and what we aimed is to help our audiences dive deeper into this understanding of climate variability and portray into in a visually appealing way, attracting and encouraging viewers to learn more about what is going on in our climate, specifically our home country. We intend to help bring key insight, and from that, spark interest and knowledge in our viewers, and start this process of climate change. There are many tools out there, but a lot of people in our generation are unaware of this. Our dashboard is the starting process of learning how to help the change and be a part of the solution. Our dashboard contains 3 core visualizations with 1 introduction visualization. The purpose of the introductory visualization is to attract our viewers with a basic understanding and visual before diving deeper into our core visualizations that both educate and are visually appealing. We ultimately aimed to tell a story of how things used to be, how they are now, and how they may be in the future. Our target audience is simply anyone curious to understand more about climate change and those who may not know anything or where to start. The key features of the 3 core graphs are briefly described below:


Key features:
   1. Current Snapshot: full-year state averages (temperature, precipitation, wind speed, direction)
   2. Yearly Trends: regional monthly means with area+line chart and tooltips, predicting trends for the next year
   3. Future Forecast: state-level 5-year temperature forecast/prediction model with ±1σ uncertainty ribbon


Since climate change is not measured yearly, but over several years, our visualization contains data for at least +5 years to showcase the appropriate findings. Below are our data sources:


**Data Sources:**
   • NOAA daily weather for states/stations (2017–2022) in data/weather.csv
   • Kaggle monthly averages per state (1950–2022) in data/average_monthly_temperature_by_state_1950-2022.csv
   • TopoJSON map via CDN (@3/states-10m.json)


**Tech Stack and Key Libraries :** D3.js v6, topojson-client, TensorFlow.js, JS, HTML/CSS


**Contributions:**
   • Introductory Visualization + Yearly Area/Line Chart Graph:
           - Divjot was responsible for these, creating the introductory visualization to allow for viewers to get a general understanding of the different variables for the "current" snapshot graph. Additionally, he was responsible for creating the area/line chart graph for the yearly trend utilizing the data from the current, to predict the trend for the next year with filters of regions instead of states to visualize changes differently.
           - Nikhil was also responsible for the creation of the yearly area/line chart, working with Divjot as well. Both worked together on the yearly trends graph to make sure it was the best representation.


   •   Future Forecast Prediction Model:
           - Nikhil was responsible for this visualization and contributed to the model for the future forecast. He helped find a bigger data set to use with over 40,000 data points to combine with the other 40,000 data points from our initial dataset. This allowed us to have huge amounts of data for better results.
           - Amindu was also responsible for this visualization as this one was the most complex under the hood. From a visualization aspect, it was clean and precise but the training, testing, debugging was all part of the big challenges when it came to this model so Amindu helped with that.


   •   Current Snapshot Visualization:
           - Amindu was responsible for the current snapshot graph that utilizes a choropleth graph to give a very appealing visualization describing different variables. This graph, along with the introductory graph, was designed to give the users/viewers a chance to be hooked into our dashboard before diving into the specifics of climate variability. It helped give them an initial understanding.


   •   Project Logistics:
           - Amindu was responsible for this, he took care of submission, the README, and the deployment for the dashboard.
           - Divjot was responsible for setting up the GitHub repo and creating the initial clones with initial skeletons for creation.
           - All 3 of us worked closely together, and communicated effectively to ensure timely completion of tasks. We all kept each other in the loop and detailed any issues or ideas we came up with during development. We all contributed well together as we have worked with each other for 3 total group projects now. We all made sure each other was on task.

**Deployed App Link:** https://cmsc471final.onrender.com/
