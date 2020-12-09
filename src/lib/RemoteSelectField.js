// This file is part of React-Invenio-Deposit
// Copyright (C) 2020 CERN.
// Copyright (C) 2020 Northwestern University.
//
// React-Invenio-Deposit is free software; you can redistribute it and/or modify it
// under the terms of the MIT License; see LICENSE file for more details.

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import _debounce from 'lodash/debounce';
import _uniqBy from 'lodash/uniqBy';
import _pickBy from 'lodash/pickBy';
import axios from 'axios';
import { Message } from 'semantic-ui-react';
import { SelectField } from './SelectField';

const DEFAULT_SUGGESTION_SIZE = 5;

// Replace part is needed since encodeURIComponent leaves some characters unescaped
// Code is taken from MDN web docs
const encodeQuery = (query) =>
  encodeURIComponent(query).replace(
    /[!'()-~*]/g,
    (char) => `%${char.charCodeAt(0).toString(16)}`
  );

const serializeSuggestions = (suggestions) =>
  suggestions.map((item) => ({
    text: item.title,
    value: item.id,
    key: item.id,
  }));

export class RemoteSelectField extends Component {
  state = {
    isFetching: false,
    suggestions: [],
    selectedSuggestions: [],
    error: false,
    searchQuery: null,
    open: false,
  };

  onSelectValue = (event, { options, value, ...rest }) => {
    const selectedSuggestions = options.filter((item) =>
      value.includes(item.value)
    );
    this.setState({
      selectedSuggestions: selectedSuggestions,
      searchQuery: null,
      error: false,
    });
  };

  handleAddition = (e, { value }) => {
    const selectedSuggestions = [
      { text: value, value, key: value },
      ...this.state.selectedSuggestions,
    ];
    this.setState((prevState) => ({
      selectedSuggestions: selectedSuggestions,
      suggestions: _uniqBy(
        [...prevState.suggestions, ...selectedSuggestions],
        'value'
      ),
    }));
  };

  onSearchChange = _debounce(async (e, { searchQuery }) => {
    this.setState({ isFetching: true, searchQuery });
    try {
      const suggestions = await this.fetchSuggestions(searchQuery);
      const serializedSuggestions = this.props.serializeSuggestions(
        suggestions
      );
      this.setState((prevState) => ({
        suggestions: _uniqBy(
          [...prevState.selectedSuggestions, ...serializedSuggestions],
          'value'
        ),
        isFetching: false,
        error: false,
        open: true,
      }));
    } catch (e) {
      this.setState({
        error: true,
        isFetching: false,
      });
    }
  }, this.props.debounceTime);

  fetchSuggestions = async (searchQuery) => {
    const {
      fetchedOptions,
      suggestionAPIUrl,
      suggestionAPIQueryParams,
    } = this.props;

    // TODO: remove this part once backend will be implemented
    // for Subjects and Affiliations components
    if (fetchedOptions) {
      const response = {
        data: {
          hits: {
            hits: fetchedOptions.filter((item) =>
              item.title.toLowerCase().includes(searchQuery.toLowerCase())
            ),
          },
        },
      };
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          // const random_boolean = Math.random() < 0.5;
          // if (random_boolean) {
          //   resolve(response.data.hits.hits);
          // } else {
          //   reject('Something went wrong');
          // }
          resolve(response.data.hits.hits);
        }, 100);
      });
    }

    return axios
      .get(suggestionAPIUrl, {
        params: {
          q: `${encodeQuery(searchQuery)}*`,
          size: DEFAULT_SUGGESTION_SIZE,
          ...suggestionAPIQueryParams,
        },
      })
      .then((resp) => resp?.data?.hits?.hits);
  };

  getNoResultsMessage = () => {
    if (this.state.error) {
      return (
        <Message
          negative
          size="mini"
          content={this.props.suggestionsErrorMessage}
        ></Message>
      );
    }
    if (!this.state.searchQuery) {
      return this.props.noQueryMessage;
    }
    return this.props.noResultsMessage;
  };

  onBlur = () => {
    this.setState((prevState) => ({
      open: false,
      error: false,
      searchQuery: null,
      suggestions: [...prevState.selectedSuggestions],
    }));
  };

  onFocus = () => {
    this.setState({ open: true });
  };

  getProps = () => {
    const {
      fieldPath,
      suggestionAPIUrl,
      suggestionAPIQueryParams,
      serializeSuggestions,
      debounceTime,
      noResultsMessage,
      suggestionsErrorMessage,
      noQueryMessage,
      fetchedOptions,
      ...uiProps
    } = this.props;
    const compProps = {
      fieldPath,
      suggestionAPIUrl,
      suggestionAPIQueryParams,
      serializeSuggestions,
      debounceTime,
      noResultsMessage,
      suggestionsErrorMessage,
      noQueryMessage,
      fetchedOptions,
    };
    return { compProps, uiProps };
  };

  render() {
    const { compProps, uiProps } = this.getProps();
    return (
      <SelectField
        {...uiProps}
        fieldPath={compProps.fieldPath}
        options={this.state.suggestions}
        noResultsMessage={this.getNoResultsMessage()}
        search
        lazyLoad
        open={this.state.open}
        onFocus={this.onFocus}
        onBlur={this.onBlur}
        onSearchChange={this.onSearchChange}
        onAddItem={this.handleAddition}
        onChange={({ event, data, formikProps }) => {
          this.onSelectValue(event, data);
          formikProps.form.setFieldValue(compProps.fieldPath, data.value);
        }}
        loading={this.state.isFetching}
      />
    );
  }
}

RemoteSelectField.propTypes = {
  fieldPath: PropTypes.string.isRequired,
  suggestionAPIUrl: PropTypes.string.isRequired,
  suggestionAPIQueryParams: PropTypes.object,
  serializeSuggestions: PropTypes.func,
  debounceTime: PropTypes.number,
  noResultsMessage: PropTypes.string,
  suggestionsErrorMessage: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
  ]),
  noQueryMessage: PropTypes.string,
  fetchedOptions: PropTypes.array, //TODO: remove this after vocabularies implementation
};

RemoteSelectField.defaultProps = {
  debounceTime: 500,
  suggestionAPIQueryParams: {},
  serializeSuggestions: serializeSuggestions,
  suggestionsErrorMessage: 'Something went wrong...',
  noQueryMessage: 'Search...',
  noResultsMessage: 'No results found.',
};