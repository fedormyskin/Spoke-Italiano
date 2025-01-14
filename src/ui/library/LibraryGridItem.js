import React, { Component } from "react";
import PropTypes from "prop-types";
import { ContextMenuTrigger } from "react-contextmenu";
import styled from "styled-components";

const StyledLibraryGridItem = styled.div`
  display: flex;
  flex-direction: column;
  height: 100px;
  border-radius: 6px;
  background-color: ${props => props.theme.panel2};
  border: 1px solid transparent;
  overflow: hidden;
  text-decoration: none;
  user-select: none;

  &:hover {
    color: inherit;
    border-color: ${props => props.theme.selected};
  }
`;
const ThumbnailContainer = styled.div`
  display: flex;
  flex: 1 0 auto;
  justify-content: center;
  align-items: stretch;
  background-color: ${props => props.theme.panel};
`;
const Thumbnail = styled.div`
  display: flex;
  flex: 1;
  background-size: cover;
  background-position: 50%;
  background-repeat: no-repeat;
`;
const ThumbnailVideo = styled.video`
  display: flex;
  flex: 1;
`;
const IconLibraryItem = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 8px;
  text-align: center;
  overflow: hidden;

  i {
    font-size: 32px;
    margin-bottom: 8px;
  }

  div {
    display: block;
    text-overflow: ellipsis;
    overflow: hidden;
    width: 100%;
  }
`;

const typeToClassName = {
  image: "fa-image",
  video: "fa-film",
  model: "fa-cube"
};

function renderItem(item) {
  if (item.images && item.images.preview && item.images.preview.url) {
    return (
      <ThumbnailContainer>
        {item.images &&
          item.images.preview &&
          (item.images.preview.type !== "mp4" ? (
            <Thumbnail style={{ backgroundImage: `url(${item.images.preview.url})` }} />
          ) : (
            <ThumbnailVideo autoPlay src={item.images.preview.url} />
          ))}
      </ThumbnailContainer>
    );
  }

  const className = item.iconClassName || typeToClassName[item.type];

  return (
    <IconLibraryItem>
      {className && <i className={`fas ${className}`} />}
      <div>{item.name}</div>
    </IconLibraryItem>
  );
}

function collectMenuProps({ item }) {
  return { item };
}

export default class LibraryGridItem extends Component {
  static propTypes = {
    tooltipId: PropTypes.string.isRequired,
    item: PropTypes.object.isRequired,
    onClick: PropTypes.func.isRequired,
    renderItem: PropTypes.func.isRequired
  };

  static defaultProps = {
    renderItem
  };

  onClick = e => {
    e.preventDefault();
    this.props.onClick(this.props.item, e);
  };

  render() {
    const { item, tooltipId, renderItem } = this.props;

    return (
      <ContextMenuTrigger id={tooltipId} item={item} collect={collectMenuProps} holdToDisplay={-1}>
        <StyledLibraryGridItem onClick={this.onClick} data-tip={item.id} data-for={tooltipId}>
          {renderItem(item)}
        </StyledLibraryGridItem>
      </ContextMenuTrigger>
    );
  }
}
