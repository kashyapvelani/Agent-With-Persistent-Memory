FROM langchain/langgraphjs-api:20
ADD . /deps/agent
ENV LANGSERVE_GRAPHS='{"nexgenesis-agent":"./src/agent/graph.ts:graph"}'
WORKDIR /deps/agent
RUN npm i
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts