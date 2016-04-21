var FizzBuzz = function (){
};

FizzBuzz.prototype.divisibleBy = function(number, divisor) {
	// return false;
	// return true;
	return number % divisor === 0;
};

FizzBuzz.prototype.convertToFizzBuzz = function(number) {
	// return "Buzz";
	// return "Fizz";
	if ( this.divisibleBy(number, 15) ) {
		return "FizzBuzz";
	}
	if ( this.divisibleBy(number, 5) ) {
		return "Buzz";
	}
	if ( this.divisibleBy(number, 3) ) {
		return "Fizz";
	}
	return number.toString();
};

module.exports = FizzBuzz;