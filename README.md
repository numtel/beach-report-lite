# Beach Report Lite

[![Build Status](https://travis-ci.org/numtel/beach-report-lite.svg?branch=master)](https://travis-ci.org/numtel/beach-report-lite)

Lightweight version of [beachreportcard.org](https://beachreportcard.org)

## Installation

```sh
$ git clone https://github.com/numtel/beach-report-lite.git
$ cd beach-report-lite

# "npm install" not required since there's no dependencies!

# Serve on port 3000
$ npm start

# Run test suite
$ npm test
```

## Design Philosophy

[Tweeted as "Modern Web Development"](https://twitter.com/jaredpalmer/status/1142800704580591617), the overwhelming complexity of dependencies required for a web site built today is represented in stacked rafts:

![Multi-stacked rafts](docs/stack.jpg)

Things were so simple when writing old PHP sites and then uploading the `.php` files to shared hosting but persisting data between requests requires adding another application to the stack like Redis or Memcache.

I started to wonder: what does it take to write a dynamic website using Node.js without any dependencies?

This is not a prescription that all applications should be written this way, only to serve as a spark for the imagination.

### Back-end

#### No left-pad surpises

Standard packages such as Express, EJS, Request have been replaced with custom versions that only require built-in Node.js modules. Other functions that could be adapted from StackOverflow answers or simple packages have been included inline with the source code.

### Front-end

The dream of the 90s is alive in simple, accessible pages.

#### Element Attribute Event Handlers not considered evil

Shunned since Y2K, using event handlers in HTML element attributes is widely considered bad practice. Rethink this and see that they might actually be the best practice. In the search form, they are used in order to connect the form inputs to eachother for easier input.

```html
<select id="lat_sel"
    onclick="event.target.form.lat.value = event.target.value"
    onchange="event.target.form.lat.value = event.target.value">
```

In the case of this select element, both the `onclick` and `onchange` handlers must be defined in order to handle how various browsers interpret selecting a new value but in accordance with KISS pricipals, abstracting this short statement into a function would be more trouble than it's worth. Form input elements with the `id` attribute specified may be accessed under the form object by their id, no extra code to manage fields required.

Modern Javascript view libraries like React, Vue, and LitHtml all provide custom implementations of these attribute event handlers. The standard ones work fine though and an extra library is not required.

```html
<button type="button" onclick="setLatToMe(event.target.form)">Use my location</button>
```

In the case of the "Use my location" button, the method is a bit too verbose to fit into the attribute value so a separate function is defined and invoked. This function exists in the global scope because when you make a page simple enough and do not include any third-party libraries, there is no problem with adding functions at the top level.

#### Tables as layout elements

While, of course, the results table is rendered using an HTML `<table>` element, the form's fieldset is as well, in order to provide a columnar layout between the field labels and the fields themselves. This is the simplest way to ensure that the input fields line up vertically in a column.

When printing the search results, the header row on the table is repeated if the results span more than one page.

#### HTML input validation attributes

```html
<input type="range" required min="5" max="100" step="1">

<input type="text" pattern="[A-Za-z]{3}" title="Three letter country code">
```

Forms inputs have attributes available like `required`, `min`, `max`, `step`, `pattern`, and `maxlength` that browsers will automatically provide validation and prevent submission with improper values. There is no Javascript required to have contextual form validation when the input fields are designed around what is available by the browser.

The second example is not used in this application but it shows a very powerful feature of HTML that is seldomly used. If the regular expression is not matched, the browser will display a popup tip containing the `title` attribute as a clue to the user how to fix their input value.

#### No AJAX anywhere

```html
<form method="GET">
```

The form submits and the page reloads with the results. The user can press the back button and see their previous search. A bookmark of the search results can be made to come back to the same page at a later time. These are all standard browser behaviors that have always existed and we should embrace them without recreating them using complicated Javascript.
