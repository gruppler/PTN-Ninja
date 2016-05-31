define({

  root: {
    App_Title: "PTN Player",

    Clock: "Clock",
    Date: "Date",
    Event: "Event",
    n_characters: "<%=n%> characters",
    Permalink: "Permalink",
    Player1: "Player1",
    Player2: "Player2",
    Points: "Points",
    Rating1: "Rating1",
    Rating2: "Rating2",
    Result: "Result",
    Round: "Round",
    Site: "Site",
    Size: "Size",
    TPS: "TPS",
    Time: "Time",

    success: {},

    warning: {
      long_url: "The permalink is over 2000 characters long, which might not work in some browsers."
    },

    error: {
      illegal_move: "Illegal move: \"<b><%=move%></b>\"",
      invalid_body: "Invalid movetext",
      invalid_file_format: "Invalid file format",
      invalid_header: "Invalid header",
      invalid_move: "Invalid move: \"<b><%=move%></b>\"",
      invalid_square: "Invalid square: \"<b><%=square%></b>\"",
      invalid_tag: "Invalid tag: \"<b><%=tag%></b>\"",
      invalid_tag_value: "Invalid <%=tag%>: \"<b><%=value%></b>\"",
      missing_tags: "Missing required tag(s): <b><%=_.map(tags, _.upperFirst).join('</b>, <b>')%></b>"
    },

    help: {},

    info: {},

  }

});
