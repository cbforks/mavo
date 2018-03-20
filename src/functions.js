/**
 * Functions available inside Mavo expressions
 */

(function($, val) {

var _ = Mavo.Functions = {
	operators: {
		"=": "eq"
	},

	/**
	 * Get a property of an object. Used by the . operator to prevent TypeErrors
	 */
	get: function(obj, property, meta = {}) {
		property = meta.property = val(property);
		var canonicalProperty = Mavo.getCanonicalProperty(obj, property);

		if (canonicalProperty !== undefined) {
			meta.property = canonicalProperty;
			var ret = obj[canonicalProperty];

			if (typeof ret === "function" && ret.name.indexOf("bound") !== 0) {
				return ret.bind(obj);
			}

			return ret;
		}

		if (Array.isArray(obj) && property && isNaN(property)) {
			// Array and non-numerical property
			var eqIndex = property.indexOf("=");

			if (eqIndex > -1) {
				// Property query
				meta.query = {
					property: property.slice(0, eqIndex),
					value: property.slice(eqIndex + 1)
				};

				meta.property = [];

				ret = obj.filter((e, i) => {
					var passes = _.get(e, meta.query.property) == meta.query.value;

					if (passes) {
						meta.property.push(i);
					}

					return passes;
				});

				if (meta.query.property == "id") {
					meta.property = meta.property[0];
					ret = ret[0];
				}

				if (ret === undefined) {
					meta.property = obj.length;
				}
				else if (ret.length === 0) {
					meta.property = [obj.length];
				}

				return ret;
			}
			else {
				// Not a property query, get from objects inside
				// TODO meta.property = ??
				return obj.map(e => _.get(e, property));
			}
		}

		// Not found :(
		return null;
	},

	call: function(fn, args, thisArg) {
		if (!fn) {
			return;
		}

		if (typeof fn !== "function") {
			if (fn[Mavo.toNode]) {
				// there is a node with the same property as a function name. Fix this. (rel #227)
				// In the future we may also introduce calling nodes as functions, and the structure is here
				var node = fn[Mavo.toNode];
				fn = _._Trap[node.property];
			}
		}

		if (typeof fn === "function") {
			return fn.apply(thisArg, args);
		}
	},

	url: (id, url = location) => {
		if (id === undefined) {
			return location.href;
		}

		if (id) {
			id = str(id).replace(/[^\w-:]/g);

			var ret = url.search.match(RegExp(`[?&]${id}(?:=(.+?))?(?=$|&)`))
			       || url.pathname.match(RegExp(`(?:^|\\/)${id}\\/([^\\/]*)`));
		}

		return ret === null || !id? null : decodeURIComponent(ret[1]) || "";
	},

	// TODO return first/last non-null?
	first: arr => arr && arr[0] || "",
	last: arr => arr && arr[arr.length - 1] || "",

	unique: function(arr) {
		if (!Array.isArray(arr)) {
			return arr;
		}

		return [...new Set(arr.map(val))];
	},

	/**
	 * Do two arrays or sets have a non-empty intersection?
	 * @return {Boolean}
	 */
	intersects: function(arr1, arr2) {
		if (arr1 && arr2) {
			var set2 = new Set(arr2.map? arr2.map(val): arr2);
			arr1 = arr1.map? arr1.map(val) : [...arr1];

			return !arr1.every(el => !set2.has(el));
		}
	},

	/*********************
	 * Number functions
	 *********************/

	/**
	 * Aggregate sum
	 */
	sum: function(array) {
		return $u.numbers(array, arguments).reduce((prev, current) => {
			return +prev + (+current || 0);
		}, 0);
	},

	/**
	 * Average of an array of numbers
	 */
	average: function(array) {
		array = $u.numbers(array, arguments);

		return array.length && _.sum(array) / array.length;
	},

	/**
	 * Min of an array of numbers
	 */
	min: function(array) {
		return Math.min(...$u.numbers(array, arguments));
	},

	/**
	 * Max of an array of numbers
	 */
	max: function(array) {
		return Math.max(...$u.numbers(array, arguments));
	},

	count: function(array) {
		return Mavo.toArray(array).filter(a => !empty(a)).length;
	},

	reverse: function(array) {
		return Mavo.toArray(array).slice().reverse();
	},

	round: function(num, decimals) {
		if (not(num) || not(decimals) || !isFinite(num)) {
			return Math.round(num);
		}

		return +num.toLocaleString("en-US", {
			useGrouping: false,
			maximumFractionDigits: decimals
		});
	},

	ordinal: function(num) {
		if (empty(num)) {
			return "";
		}

		if (ord < 10 || ord > 20) {
			var ord = ["th", "st", "nd", "th"][num % 10];
		}

		return ord || "th";
	},

	digits: (digits, decimals, num) => {
		if (num === undefined) {
			num = decimals;
			decimals = undefined;
		}

		if (isNaN(num)) {
			return null;
		}

		var parts = (num + "").split(".");

		// If it has more digits than n = digits, only keep the last n digits.
		parts[0] = parts[0].slice(-digits);

		// Chop extra decimals without rounding
		if (decimals !== undefined && parts[1]) {
			parts[1] = parts[1].slice(0, decimals);
		}

		num = +parts.join(".");

		// This is mainly for padding with zeroes, we've done the rest already
		return num.toLocaleString("en", {
			useGrouping: false, // we want something that can be converted to a number again
			minimumIntegerDigits: digits,
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals || 20
		});
	},

	iff: function(condition, iftrue=condition, iffalse="") {
		if (Array.isArray(condition)) {
			return condition.map((c, i) => {
				var ret = val(c)? iftrue : iffalse;

				return Array.isArray(ret)? ret[Math.min(i, ret.length - 1)] : ret;
			});
		}

		return val(condition)? iftrue : iffalse;
	},

	group: (...objects) => Object.assign(...objects),
	list: (...items) => items,

	// FIXME if step=0 returns NaN
	random: function(min = 0, max = 100, step = 1) {
		if (arguments.length == 1) {
			max = min;
			min = 0;
		}

		var rand = Math.random();
		var range = (max - min)  / step;
		return Math.floor(rand * (range + 1)) * step + min;
	},

	shuffle: list => {
		if (Array.isArray(list)) {
			return list.sort(() => Math.random() - 0.5);
		}
		else {
			return list;
		}
	},

	/*********************
	 * String functions
	 *********************/

	/**
	 * Replace all occurences of a string with another string
	 */
	replace: function(haystack, needle, replacement = "", iterations = 1) {
		if (Array.isArray(haystack)) {
			return haystack.map(item => _.replace(item, needle, replacement));
		}

		// Simple string replacement
		var needleRegex = RegExp(Mavo.escapeRegExp(needle), "g");
		var ret = haystack, prev;
		var counter = 0;

		while (ret != prev && (counter++ < iterations)) {
			prev = ret;
			ret = ret.replace(needleRegex, replacement);
		}

		return ret;
	},

	len: text => str(text).length,

	/**
	 * Case insensitive search
	 */
	search: (haystack, needle) => haystack && needle? str(haystack).toLowerCase().indexOf((needle + "").toLowerCase()) : -1,

	starts: (haystack, needle) => _.search(str(haystack), str(needle)) === 0,
	ends: function(haystack, needle) {
		[haystack, needle] = [str(haystack), str(needle)];

		var i = _.search(haystack, needle);
		return  i > -1 && i === haystack.length - needle.length;
	},

	join: function(array, glue) {
		return Mavo.toArray(array).filter(a => !empty(a)).join(str(glue));
	},

	idify: function(readable) {
		return str(readable)
			.normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Convert accented letters to ASCII
			.replace(/[^\w\s-]/g, "") // Remove remaining non-ASCII characters
			.trim().replace(/\s+/g, "-") // Convert whitespace to hyphens
			.toLowerCase();
	},

	// Convert an identifier to readable text that can be used as a label
	readable: function (identifier) {
		// Is it camelCase?
		return str(identifier)
				.replace(/([a-z])([A-Z])(?=[a-z])/g, ($0, $1, $2) => $1 + " " + $2.toLowerCase()) // camelCase?
				.replace(/([a-z0-9])[_\/-](?=[a-z0-9])/g, "$1 ") // Hyphen-separated / Underscore_separated?
				.replace(/^[a-z]/, $0 => $0.toUpperCase()); // Capitalize
	},

	uppercase: text => str(text).toUpperCase(),
	lowercase: text => str(text).toLowerCase(),

	from: (haystack, needle) => _.between(haystack, needle),
	fromlast: (haystack, needle) => _.between(haystack, needle, "", true),
	to: (haystack, needle) => _.between(haystack, "", needle),
	tofirst: (haystack, needle) => _.between(haystack, "", needle, true),

	between: (haystack, from, to, tight) => {
		[haystack, from, to] = [str(haystack), str(from), str(to)];

		var i1 = from? haystack[tight? "lastIndexOf" : "indexOf"](from) : -1;
		var i2 = haystack[tight? "indexOf" : "lastIndexOf"](to);

		if (from && i1 === -1 || i2 === -1) {
			return "";
		}

		return haystack.slice(i1 + 1, i2 === -1 || !to? haystack.length : i2);
	},

	filename: url => Mavo.match(new URL(str(url), Mavo.base).pathname, /[^/]+?$/),

	json: data => Mavo.safeToJSON(data),

	split: (text, separator = /\s+/) => {
		return Mavo.Script.binaryOperation(text, separator, {
			scalar: (text, separator) => {

				text = str(text);

				return text.split(separator);
			}
		});
	},

	// Log to the console and return
	log: (...args) => {
		console.log(...args.map(val));
		return args[0];
	},

	// Other special variables (some updated via events)
	$mouse: {x: 0, y: 0},

	get $hash() {
		return location.hash.slice(1);
	},

	// "Private" helpers
	util: {
		numbers: function(array, args) {
			array = Array.isArray(array)? array : (args? $$(args) : [array]);

			return array.filter(number => !isNaN(number) && val(number) !== "" && val(number) !== null).map(n => +n);
		},
	}
};

var $u = _.util;

// Make function names case insensitive
_._Trap = self.Proxy? new Proxy(_, {
	get: (functions, property) => {
		var ret;

		if (typeof property === "symbol") {
			return;
		}

		if (Mavo.Functions.actionRunning && property in Mavo.Actions.Functions) {
			return Mavo.Actions.Functions[property];
		}

		var canonicalProperty = Mavo.getCanonicalProperty(functions, property)
		                     || Mavo.getCanonicalProperty(Math, property);

		if (canonicalProperty) {
			ret = functions[canonicalProperty];

			if (ret === undefined) {
				ret = Math[canonicalProperty];
			}
		}

		if (ret !== undefined) {
			if (typeof ret === "function") {
				// For when function names are used as unquoted strings, see #160
				ret.toString = () => property;
			}

			return ret;
		}

		// Still not found? Maybe it's a global
		if (property in self) {
			return self[property];
		}

		// Prevent undefined at all costs
		return property;
	},

	// Super ugly hack, but otherwise data is not
	// the local variable it should be, but the string "data"
	// so all property lookups fail.
	has: (functions, property) => property != "data"
}) : _;

/**
 * Private helper methods
 */

// Convert argument to string
function str(str = "") {
	str = val(str);
	return !str && str !== 0? "" : str + "";
}

function empty(v) {
	v = Mavo.value(v);
	return v === null || v === false || v === "";
}

function not(v) {
	return !val(v);
}

})(Bliss, Mavo.value);
